import random
from datetime import datetime, timedelta
from enum import Enum
from typing import Iterator

from metafinder_core.models import FileModel
from model.job import GenerationJob
from model.types import Coordinate, Location, FileData


class FileDeletedState(Enum):
    UNKNOWN = 'Unknown'
    INTACT = 'Intact'
    DELETED = 'Deleted'
    TRASH = 'Trash'


def random_times(n: int, job: GenerationJob) -> Iterator[datetime]:
    """Generate random timestamps (datetime objects) in device's life range"""
    start_dt = datetime(job.context.start_date.year, job.context.start_date.month,
                        job.context.start_date.day, tzinfo=job.context.timezone)
    end_dt = datetime(job.context.end_date.year, job.context.end_date.month,
                      job.context.end_date.day, tzinfo=job.context.timezone)

    if job.context.timezone is None:
        start_dt, end_dt = start_dt.astimezone(), end_dt.astimezone()   # Use local server timezone

    max_delta = int((end_dt - start_dt).total_seconds())
    for _ in range(n):
        delta = random.randrange(max_delta+1)
        yield start_dt + timedelta(seconds=delta)


def create_file_data_from_metafinder_metadata[FD: FileData](
        data_class: type[FD],
        metadata: FileModel,
        deleted_state: FileDeletedState,
        location: Location | None,
        **kwargs
) -> FD:
    file_data = data_class(
        md5=metadata.md5,
        s3_key=metadata.s3_key,
        format=metadata.format,
        size=metadata.size,
        deleted_state=deleted_state.value,
        location_id=location.uid if location else None,
        coordinate=Coordinate(
            lon=location.longitude,
            lat=location.latitude
        ) if location else None,
        **kwargs)
    return file_data
