from pathlib import Path

from abc import ABC, abstractmethod
from typing import Callable, ClassVar, Any

from core.config import SETTINGS
from model.stories import StoryData, StoryType, StoryFileTypes, LocationStoryData, FileStoryData
from model.types import EventData, EventType, Coordinate, FileData


class Author[SD: StoryData, ED: EventData](ABC):
    event_type: ClassVar[EventType]

    @abstractmethod
    def translate(self, story_data: SD, event_context: dict[str, EventData]) -> ED:
        """Convert StoryData object to EventData object"""
        raise NotImplementedError

    def _translate_file[FD: FileData](self, story_data: FileStoryData, data_class: type[FD]) -> FD:
        s3_key = Path(story_data.file.s3_key)
        is_upload = story_data.file.file_type == StoryFileTypes.UPLOAD

        return data_class(
            **self._get_base_generated_data_fields(story_data=story_data),
            deleted_state=story_data.deleted_state,
            s3_key=self._construct_uploaded_file_s3_key(story_data.file.s3_key) if is_upload else story_data.file.s3_key,
            is_uploaded=is_upload,
            filename=story_data.file.file_name if is_upload else None,
            md5=s3_key.stem,
            format=s3_key.suffix[1:],
            s3_bucket=SETTINGS.S3_TITAN_BUCKET_NAME if is_upload else SETTINGS.METAFINDER_S3_BUCKET_NAME,
            size=story_data.file.size
        )

    @staticmethod
    def _get_coordinate(location_story: LocationStoryData | None) -> Coordinate | None:
        if location_story is None:
            return None
        return Coordinate(lat=location_story.coordinate.latitude, lon=location_story.coordinate.longitude)

    @classmethod
    def _get_base_generated_data_fields(cls, story_data: SD) -> dict[str, Any]:
        return {
            'uid': story_data.story_id,
            'time': story_data.time,
            'coordinate': cls._get_coordinate(location_story=story_data.location_ref)
        }

    @staticmethod
    def _construct_uploaded_file_s3_key(s3_key: str) -> str:
        return f'{SETTINGS.S3_BUCKET_UPLOADS_PREFIX}/{s3_key}'

_author_registry: dict[StoryType, Author] = {}    # Registry of authors by story type


def register_author(story_type: StoryType, event_type: EventType) -> Callable[[type[Author]], type[Author]]:
    """
    Decorator method that globally registers an Author class to a StoryType.

    Arguments:
        story_type: StoryType to associate the Author input with.
        event_type: EventType to associate the Author output with.

    Examples:
        >>> @register_author(story_type=StoryType.LOCATION, event_type=EventType.LOCATION)
            class LocationAuthor(Author):
                ...
    """

    def _register(author_class: type[Author]) -> type[Author]:
        if story_type in _author_registry:
            raise Exception(f"Cannot register multiple authors to the same story type ({story_type})")
        author_class.event_type = event_type
        _author_registry[story_type] = author_class()   # initialize a singleton
        return author_class

    return _register


class AuthorClassNotFoundError(Exception):
    def __init__(self, story_type: StoryType):
        super().__init__(f'Author for story type "{story_type}" not found')


def get_author(story_type: StoryType) -> Author:
    """
    Get the Author registered to the given StoryType.

    Arguments:
        story_type: StoryType for the requested Author.

    Returns:
        Author inherited instance for the StoryType.
    """
    author = _author_registry.get(story_type)
    if author is None:
        raise AuthorClassNotFoundError(story_type=story_type)
    return author
