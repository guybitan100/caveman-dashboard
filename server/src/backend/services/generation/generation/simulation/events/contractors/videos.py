from typing import Iterator

from generation.simulation.utils import random_times, create_file_data_from_metafinder_metadata
from metafinder_core.queries import VideoQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator
from model.tasks import VideoTask
from model.types import Video, EventType

from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.events.contractors.registry import register_contractor


@register_contractor(EventType.VIDEO)
class VideoContractor(FileContractor[VideoTask, Video]):
    def construct(self) -> Iterator[Video]:
        video_metadatas = VideoQueryParams(
            min_duration=self.task.min_duration,
            max_duration=self.task.max_duration,
            formats=self.task.formats,
            categories=ArrayQuery(
                operator=QueryOperator.AND if self.task.is_categories_and_op else QueryOperator.OR,
                values=self.task.categories
            ),
        ).query(count=self.quantity)
        times = random_times(n=self.quantity, job=self.job)
        locations = self.hub.get_task_locations(task=self.task)
        deleted_states = self._random_deleted_states(self.quantity)

        videos = (
            create_file_data_from_metafinder_metadata(data_class=Video, metadata=video_metadata,
                                                      deleted_state=deleted_state, location=location, time=time)
            for video_metadata, time, deleted_state, location
            in zip(video_metadatas, times, deleted_states, locations)
        )

        yield from videos
