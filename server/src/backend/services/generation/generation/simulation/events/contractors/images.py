from typing import Iterator

from generation.simulation.utils import random_times, create_file_data_from_metafinder_metadata
from metafinder_core.queries import ImageQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator
from model.tasks import ImageTask
from model.types import Image, EventType

from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.events.contractors.registry import register_contractor


@register_contractor(EventType.IMAGE)
class ImageContractor(FileContractor[ImageTask, Image]):
    def construct(self) -> Iterator[Image]:
        image_metadatas = ImageQueryParams(
            min_width=self.task.min_width,
            max_width=self.task.max_width,
            min_height=self.task.min_height,
            max_height=self.task.max_height,
            formats=self.task.formats,
            categories=ArrayQuery(
                operator=QueryOperator.AND if self.task.is_categories_and_op else QueryOperator.OR,
                values=self.task.categories
            ),
        ).query(count=self.quantity)
        times = random_times(n=self.quantity, job=self.job)
        locations = self.hub.get_task_locations(task=self.task)
        deleted_states = self._random_deleted_states(self.quantity)

        images = (
            create_file_data_from_metafinder_metadata(data_class=Image, metadata=image_metadata,
                                                      deleted_state=deleted_state, location=location, time=time)
            for image_metadata, time, deleted_state, location
            in zip(image_metadatas, times, deleted_states, locations)
        )

        yield from images
