from typing import Iterator

from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.events.contractors.registry import register_contractor
from model.tasks import ArchiveTask
from model.types import EventType, Archive


@register_contractor(EventType.ARCHIVE)
class ArchiveContractor(FileContractor[ArchiveTask, Archive]):
    def construct(self) -> Iterator[Archive]:
        raise NotImplementedError(f'Construct is not supported for {EventType.ARCHIVE}')
