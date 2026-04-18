from typing import Iterator

from generation.simulation.utils import random_times, create_file_data_from_metafinder_metadata
from model.tasks import AudioTask
from model.types import EventType, Audio
from metafinder_core.queries import AudioQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator

from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.events.contractors.registry import register_contractor


@register_contractor(EventType.AUDIO)
class AudioContractor(FileContractor[AudioTask, Audio]):
    def construct(self) -> Iterator[Audio]:
        audio_metadatas = AudioQueryParams(
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

        audios = (
            create_file_data_from_metafinder_metadata(data_class=Audio, metadata=audio_metadata,
                                                      deleted_state=deleted_state, location=location, time=time)
            for audio_metadata, time, deleted_state, location
            in zip(audio_metadatas, times, deleted_states, locations)
        )

        yield from audios
