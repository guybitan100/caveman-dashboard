from networkx import DiGraph

from model.utils import deserialize
from titan_db.events import db
from generation.stories.authors.author import get_author
from model.stories import StoryData, StoryType, EventStoryData, GroupStoryData, StoryDataAdapter
from model.types import EventData


def publish(job_id: str, stories_graph: DiGraph) -> None:
    """Converts StoryData objects to EventData objects and saves them to the DB"""
    stories = [
        deserialize(story_data, StoryDataAdapter)
        for story_id, story_data in stories_graph.nodes.data('data')
    ]
    id_to_story_data: dict[str, StoryData] = _get_id_to_story_data(stories=stories)
    # Reverse lookup of store app_id to app story's UID (same UID used for published app event)
    #   NOTE: Corner case exists where multiple app stories have same app_id
    app_id_to_app_story_uid = {story.app.app_id: story.story_id for story in stories if story.story_type is StoryType.APP}
    id_to_event_data: dict[str, EventData] = {}

    # Resolve inner story references and translate stories to events
    events = (
        _resolve_story_refs_and_translate(
            story=story,
            id_to_story=id_to_story_data,
            id_to_event=id_to_event_data,
            app_id_to_app_story_uid=app_id_to_app_story_uid
        )
        for story in id_to_story_data.values()
    )

    db.write_events(job_id=job_id, events=events)


def _get_id_to_story_data(stories: list[StoryData]) -> dict[str, StoryData]:
    id_to_story_data = {}
    for story in stories:
        if isinstance(story, GroupStoryData):   # e.g., route, chat
            for inner_story in story.get_inner_stories():
                id_to_story_data[inner_story.story_id] = inner_story
        else:
            id_to_story_data[story.story_id] = story
    return id_to_story_data


def _resolve_story_refs_and_translate(
        story: StoryData,
        id_to_story: dict[str, StoryData],
        id_to_event: dict[str, EventData],
        app_id_to_app_story_uid: dict[str, str]
) -> EventData:
    """Recursively set stories in place of their refs and translate them to events"""
    if story.story_id in id_to_event:    # Story has already been resolved
        return id_to_event[story.story_id]

    # Resolve story references
    _resolve_story_refs(story=story, id_to_story=id_to_story, id_to_event=id_to_event, app_id_to_app_story_uid=app_id_to_app_story_uid)
    if isinstance(story, GroupStoryData):
        for inner_story in story.get_inner_stories():
            _resolve_story_refs(story=inner_story, id_to_story=id_to_story, id_to_event=id_to_event, app_id_to_app_story_uid=app_id_to_app_story_uid)

    author = get_author(story_type=story.story_type)    # Get story's corresponding author
    event = author.translate(story_data=story, event_context=id_to_event)   # Translate story to event
    # Update event's linked app for non-app stories that reference an app story (assume event is EventData, has app_uid)
    if isinstance(story, EventStoryData) and story.app_id is not None and story.story_type is not StoryType.APP:
        event.app_uid = app_id_to_app_story_uid[story.app_id]   # Set app (we assume app story exists or KeyError)
    id_to_event[story.story_id] = event

    return event


def _resolve_story_refs(
        story: StoryData,
        id_to_story: dict[str, StoryData],
        id_to_event: dict[str, EventData],
        app_id_to_app_story_uid: dict[str, str]
) -> None:
    for field_name, field_value in story.get_story_ref_fields().items():
        if isinstance(field_value, str):
            ref_story = id_to_story[field_value]
            _resolve_story_refs_and_translate(story=ref_story, id_to_story=id_to_story, id_to_event=id_to_event, app_id_to_app_story_uid=app_id_to_app_story_uid)
            setattr(story, field_name, ref_story)
        elif isinstance(field_value, list):
            for i, value in enumerate(field_value):
                if isinstance(value, str):
                    try:
                        ref_story = id_to_story[value]
                    except KeyError:
                        raise ValueError(
                            f"Story with ID {value} not found in the job's stories. parent_story_id={story.story_id},"
                            f" field_name={field_name}")
                    _resolve_story_refs_and_translate(story=ref_story, id_to_story=id_to_story, id_to_event=id_to_event, app_id_to_app_story_uid=app_id_to_app_story_uid)
                    field_value[i] = ref_story
