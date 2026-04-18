from typing import Iterator

from generation.simulation.utils import random_times, create_file_data_from_metafinder_metadata
from metafinder_core.queries import DocumentQueryParams
from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.events.contractors.registry import register_contractor
from model.tasks import DocumentFormat, DocumentTask
from model.types import Document, EventType


_doc_type_to_data_type = {DocumentFormat.TXT: "Text"}


@register_contractor(EventType.DOCUMENT)
class DocumentContractor(FileContractor[DocumentTask, Document]):
    def construct(self) -> Iterator[Document]:
        doc_metadatas = DocumentQueryParams(
            min_size=self.task.min_size,
            max_size=self.task.max_size,
            formats=self.task.formats
        ).query(count=self.quantity)
        times = random_times(n=self.quantity, job=self.job)
        locations = self.hub.get_task_locations(task=self.task)
        deleted_states = self._random_deleted_states(self.quantity)

        documents = (
            create_file_data_from_metafinder_metadata(data_class=Document, metadata=doc_metadata,
                                                      deleted_state=deleted_state, location=location,
                                                      data_type=self._get_data_type(doc_metadata.format), time=time)
            for doc_metadata, time, deleted_state, location
            in zip(doc_metadatas, times, deleted_states, locations)
        )

        yield from documents
