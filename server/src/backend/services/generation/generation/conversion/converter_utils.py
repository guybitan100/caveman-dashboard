import os
import threading
from pathlib import Path
from queue import Empty, Queue
from typing import Iterator

from core.config import SETTINGS
from core.s3_client import SixS3Client
from core.six_logger import logger
from generation.conversion.report import ExtraInfo, NodeInfo, SourceInfo, NodeInfos, ProjectConfigurations, \
    TimeZoneConfigurations, SourceExtractions, ExtractionInfo, CaseInformation, InfoField, Metadata, Item
from model.types import DeviceInfo, FileData
from model.utils import str_uuid

_SIX_TABLE_NAME = 'SIX'
_SIX_OFFSET = '0'
_SIX_NODE_INFO_ID = '00000000-0000-0000-0000-000000000001'


def create_source_extractions() -> SourceExtractions:
    extractions = SourceExtractions(
        extraction_infos=[
            ExtractionInfo(
                id=0,
                name='Physical',
                is_custom_name='False',
                type='Physical',
                device_name='SiX Device',
                full_name='SiX Device',
                index=0,
                is_partial_data='False'
            )
        ]
    )
    return extractions


def create_case_information() -> CaseInformation:
    case_info = CaseInformation(
        fields=[
            InfoField(
                name='Examiner name',
                is_system=True,
                is_required=True,
                field_type='ExaminerName',
                multiple_lines=False,
                value='SiX',
            )
        ]
    )
    return case_info


def create_device_info_metadata(device_info: DeviceInfo) -> Metadata:
    items = [
        Item(
            id=str_uuid(),
            name=item.key,
            group='Metadata',
            extraction='0',
            value=item.value,
        )
        for item in device_info.entries
    ]
    metadata = Metadata(section='Device Info', items=items)
    return metadata


def get_model_extra_info(model_id: str) -> ExtraInfo:
    return ExtraInfo(
        type='model',
        id=model_id,
        source_info=SourceInfo(
            node_infos=NodeInfos(
                node_infos=[
                    NodeInfo(
                        id=_SIX_NODE_INFO_ID,
                        table_name=_SIX_TABLE_NAME,
                        offset=_SIX_OFFSET
                    )])
        )
    )


def get_file_extra_info(file_id: str) -> ExtraInfo:
    return ExtraInfo(
        type='node',
        id=file_id,
        source_info=SourceInfo(
            node_info=NodeInfo(
                id=file_id,
                table_name="",
                offset=_SIX_OFFSET
            )
        )
    )


def create_project_configurations() -> ProjectConfigurations:
    project_configs = ProjectConfigurations(
        timezone=TimeZoneConfigurations(
            enable_daylight_savings=True,
            enable_automatically_convert_to_utc=False,
            selected_time_zone='_Europe/Helsinki',
        )
    )
    return project_configs


class FileDataDownloader:
    def __init__(
            self,
            file_datas: Iterator[FileData],
            dir_path: Path,
            max_workers: int
    ):
        self._file_datas = file_datas

        self._quota = FileDataDownloaderTempSizeQuota()
        self._inbox = Queue(maxsize=SETTINGS.MAX_FILE_DOWNLOAD_QUEUE_SIZE)
        self._outbox = Queue(maxsize=SETTINGS.MAX_FILE_DOWNLOAD_QUEUE_SIZE)
        self._workers = [
            FileDataDownloaderWorker(
                quota=self._quota,
                inbox=self._inbox,
                outbox=self._outbox,
                dir_path=dir_path,
            )
            for _ in range(max_workers)
        ]

    def get_files(self) -> Iterator[tuple[FileData, Iterator[bytes]]]:
        """Generates each file_data objects and its bytes content iterator"""
        while True:
            try:
                # Retrieve file data and temp path from outbox queue
                file_data, tmp_filepath = self._outbox.get(timeout=1)
            except Empty:
                if any(worker.is_alive() for worker in self._workers):
                    continue  # At least 1 worker is still downloading a file
                else:
                    break  # All threads have stopped, it is safe to exit
            tmpfile_stream_func = self._consume_file(tmp_filepath=tmp_filepath, file_size=file_data.size)
            yield file_data, tmpfile_stream_func

    def start_download(self):
        # Spawn workers and enqueue files
        for worker in self._workers:
            worker.start()
        threading.Thread(target=self._enqueue_file_datas).start()

    def _enqueue_file_datas(self):
        # Enqueue all files in inbox
        for file_data in self._file_datas:
            self._inbox.put(file_data)

        # Signal threads to stop (no more files to download)
        for worker in self._workers:
            worker.stop()

    def _consume_file(self, tmp_filepath: Path, file_size: int) -> Iterator[bytes]:
        try:
            with open(tmp_filepath, 'rb') as f:
                while chunk := f.read(SETTINGS.TEMP_FILE_CHUNK_SIZE):
                    yield chunk
        finally:
            tmp_filepath.unlink()
            file_exists = os.path.exists(tmp_filepath)
            # Delete, temp file has been consumed
            self._quota.free(file_size)  # Release reserved quota


class FileDataDownloaderTempSizeQuota:
    def __init__(self, max_size: int = SETTINGS.MAX_TOTAL_TEMP_FILES_SIZE_BYTES):
        self._max_size = max_size
        self._size_lock = threading.Lock()
        self._size_total = 0

    def reserve(self, size: int):
        assert size >= 0
        while True:
            with self._size_lock:
                if (self._size_total + size) > self._max_size:  # No more space for additional file DLs
                    continue  # skip download for now and try again
                self._size_total += size  # Add expected file's size
                break  # Quota has been reserved, return to caller

    def free(self, size: int):
        assert size >= 0
        with self._size_lock:
            self._size_total -= size


class FileDataDownloaderWorker(threading.Thread):
    def __init__(
            self,
            quota: FileDataDownloaderTempSizeQuota,
            inbox: Queue,
            outbox: Queue,
            dir_path: Path,
    ):
        self._quota = quota
        self._inbox = inbox
        self._outbox = outbox
        self._dir_path = dir_path
        self._s3_client = SixS3Client()
        self._stop_event = threading.Event()
        super().__init__()

    def run(self):
        """Downloads file from S3 when total size max quota has not been reached."""
        while True:
            try:
                file_data = self._inbox.get(timeout=1)  # Retrieve file from inbox queue
                self._quota.reserve(file_data.size)  # Blocks until quota becomes available
                tmp_filepath = Path(self._dir_path, file_data.uid)
                bucket = SETTINGS.METAFINDER_S3_BUCKET_NAME if not file_data.s3_bucket else file_data.s3_bucket
                self._s3_client.download_file(s3_key=file_data.s3_key, file_name=str(tmp_filepath), bucket_name=bucket)  # DL file to temp
                self._outbox.put((file_data, tmp_filepath))  # Put file and its temp path into outbox queue
            except Empty:  # Nothing on inbox queue
                if self._stop_event.is_set():  # Stop thread
                    break
            except Exception as e:
                logger.exception(f'Exception downloading file event: {e}', error=e)
                raise e

    def stop(self):
        self._stop_event.set()
