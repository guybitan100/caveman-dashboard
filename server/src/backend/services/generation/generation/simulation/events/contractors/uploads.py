from functools import partial
from pathlib import PurePath
from typing import Iterator

from core.config import SETTINGS
from generation.simulation.events.contractors.contractor import FileContractor
from generation.simulation.utils import random_times
from model.tasks import UploadedFileTask, DocumentFormat
from model.types import FileData, EventType, Document, Image, Audio, Video, Archive


_doc_type_to_data_type = {DocumentFormat.TXT: "Text"}
_event_type_to_file_data_type = {
    EventType.DOCUMENT: Document,
    EventType.IMAGE: Image,
    EventType.AUDIO: Audio,
    EventType.VIDEO: Video,
    EventType.ARCHIVE: Archive
}


class UploadedFileContractor(FileContractor[UploadedFileTask, FileData]):
    def construct(self, *args, **kwargs) -> Iterator[FileData]:
        super().__init__(*args, **kwargs)
        time = next(random_times(n=1, job=self.job))
        deleted_state = next(self._random_deleted_states(n=1))

        data_type = None
        if self.task.event_type is EventType.DOCUMENT:
            try:
                suffix = PurePath(self.task.file_name).suffix[1:]
                data_type = _doc_type_to_data_type[DocumentFormat(suffix.lower())]
            except (ValueError, KeyError):
                pass    # 'Document' by default

        data_class = _event_type_to_file_data_type[self.task.event_type]

        file_data_func = partial(
            data_class,
            filename=self.task.file_name,
            size=self.task.file_size,
            s3_key=f'{SETTINGS.S3_BUCKET_UPLOADS_PREFIX}/{self.task.md5}',
            is_uploaded=True,
            time=time,
            md5=self.task.md5,
            s3_bucket=SETTINGS.S3_SIX_BUCKET_NAME,
            deleted_state=deleted_state.value
        )
        if data_type is None:       # to accommodate literal data_types in Audio, Video, Image (avoid errors)
            file_data = file_data_func()
        else:
            file_data = file_data_func(data_type=data_type)

        return file_data
