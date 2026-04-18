from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator, Any, Iterable
from zipfile import ZipFile
import requests
import smart_open.s3
from xsdata.formats.dataclass.serializers.mixins import XmlWriterEvent

from core.config import SETTINGS
from core.six_logger import logger
from generation.utils import six_phase
from model.phase import SixPhase
from six_db.jobs import db_job_utils
from six_db.events import db
from generation.conversion.converter_utils import get_file_extra_info, get_model_extra_info, \
    create_device_info_metadata, create_source_extractions, create_case_information, create_project_configurations, \
    FileDataDownloader
from generation.conversion.custom import generate_custom_models
from generation.conversion.report import Metadata, Images, NAMESPACE, Event, EventField
from generation.conversion.serializer_context import SerializerContext
from generation.conversion.serializer_utils import TimeField
from generation.conversion.serializers import get_serializer, ReportFileSerializer, event_type_to_model_type, \
    ReportModelSerializer
from generation.conversion.xml_utils import ReportXmlSerializer
from generation import social_db
from model.job import GenerationJob
from model.manifest import Manifest, ManifestEvent
from model.types import EventType, FileData, FILE_EVENT_TYPES

# Suppress warnings
requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)


@six_phase(phase=SixPhase.Conversion)
def convert(job: GenerationJob):
    logger.info(f'Starting to convert data to UFDR', job_id=job.job_id)
    try:
        converter = _UfdrConverter(job=job)
        converter.convert()

        manifest = converter.get_manifest()
        logger.info(f'Saving Manifest', job_id=job.job_id)
        db_job_utils.add_job_manifest(job_id=job.job_id, manifest=manifest)
    except Exception as e:
        logger.error(str(e))
        raise e



@dataclass
class _XmlEvents:
    events: Iterable[tuple[str, str] | tuple[str, str, str]]


class _UfdrConverter:
    def __init__(self, job: GenerationJob):
        self._job = job
        self._context = None

        self._file_uid_to_renamed_path: dict[str, Path] = {}    # For renaming uploaded files with identical filenames
        self._total_files = 0

        self._initialize()      # Initializes social context and dict for renaming identical upload filenames

        # Store file and model counts for manifest
        self._file_counts: dict[str, int] = defaultdict(int)    # key = FileData.data_type
        self._model_counts: dict[str, int] = defaultdict(int)   # key = report model type

    @property
    def job_id(self) -> str:
        return self._job.job_id

    def convert(self) -> None:
        logger.info('Creating and uploading UFDR to S3 storage', job_id=self.job_id)

        tmp_dir = TemporaryDirectory(prefix=f'six.{self.job_id}.')
        try:
            # Create downloader before writing report to get head start downloading files
            downloader = FileDataDownloader(
                file_datas=self._file_data_iterator(sort_by_size=True),
                dir_path=Path(tmp_dir.name),
                max_workers=min(SETTINGS.MAX_CONVERTER_FILE_DL_WORKERS, self._total_files)
            )
            downloader.start_download()

            s3_ufdr_filepath = Path(SETTINGS.S3_BUCKET_JOBS_PREFIX, self.job_id, self._job.name).with_suffix('.ufdr').as_posix()
            with smart_open.s3.open(SETTINGS.S3_SIX_BUCKET_NAME, str(s3_ufdr_filepath), 'wb', min_part_size=SETTINGS.MIN_S3_PART_SIZE) as s3:
                with ZipFile(s3, 'w') as zipfile:
                    self._zip_report(zipfile=zipfile)
                    self._zip_generated_files(zipfile=zipfile, downloader=downloader)
        finally:
            tmp_dir.cleanup()

        logger.info('Finished creating and uploading UFDR to S3 storage', job_id=self.job_id)

    def get_manifest(self) -> Manifest:
        manifest = Manifest(
            id=self.job_id,
            name=self._job.name,
            files=[ManifestEvent(model_name=file_type, count=count) for file_type, count in self._file_counts.items()],
            events=[ManifestEvent(model_name=model_type, count=count) for model_type, count in self._model_counts.items()]
        )
        return manifest

    def _initialize(self) -> None:
        # Initialize social context
        social_context = social_db.read_social_context(job_id=self.job_id, entity_weights=False)
        apps = db.read_referenced_apps(job_id=self.job_id)
        self._context = SerializerContext(social_context=social_context, apps=apps)

        # Keep track of count of uploaded files with duplicate filenames
        filepath_to_duplicate_count: dict[Path, int] = defaultdict(int)

        # Create and populate social context
        event_types = db.get_all_event_types(job_id=self.job_id)
        for event_type in event_types:
            is_file_type = event_type in FILE_EVENT_TYPES
            serializer = ReportFileSerializer if is_file_type else get_serializer(event_type)

            if event_type is EventType.CHAT:
                datas = db.read_chat_events_without_messages(job_id=self.job_id)
            else:
                datas = db.read_events(job_id=self.job_id, event_type=event_type, include_nested_models=False)
            for data in datas:
                serializer.register_base_jump_targets(self._context, data)
                serializer.register_jump_targets(self._context, data)

                # Rename uploaded files that have duplicate filepaths
                if is_file_type:
                    self._total_files += 1
                    if data.is_uploaded:
                        if n_dupes := filepath_to_duplicate_count[data.path]:     # Leave the first filename unchanged
                            self._file_uid_to_renamed_path[data.uid] = data.path.with_stem(f'{data.path.stem} ({n_dupes})')
                        filepath_to_duplicate_count[data.path] += 1

    def _file_data_iterator(self, sort_by_size: bool = False) -> Iterator[FileData]:
        file_datas = db.read_file_events(job_id=self.job_id, sort_by_size=sort_by_size)
        for file_data in file_datas:
            file_data.path = self._file_uid_to_renamed_path.get(file_data.uid, file_data.path)
            yield file_data

    def _zip_report(self, zipfile: ZipFile) -> None:
        with zipfile.open('report.xml', 'w', force_zip64=True) as report_xml_zipfile:
            with ReportXmlSerializer(output=report_xml_zipfile, namespace=NAMESPACE) as report_serializer:
                for obj_or_xml_events in self._serialize_report(report_serializer=report_serializer):
                    if isinstance(obj_or_xml_events, _XmlEvents):
                        report_serializer.write_events(obj_or_xml_events.events)
                    else:
                        report_serializer.write_report_object(obj_or_xml_events)

    def _zip_generated_files(self, zipfile: ZipFile, downloader: FileDataDownloader) -> None:
        if not self._total_files:
            return  # no generated files

        logger.debug(f'Zipping generated files (job_id={self.job_id})', job_id=self.job_id)

        downloaded = 0
        for file_data, content_generator in downloader.get_files():
            downloaded += 1
            with zipfile.open(str(file_data.path), 'w', force_zip64=True) as f:
                for chunk in content_generator:
                    f.write(chunk)

        if downloaded != self._total_files:
            logger.error(
                f'Warning: {self._total_files - downloaded} of {self._total_files} '
                f'requested files were not included in UFDR!',
                job_id=self.job_id
            )
        logger.debug(f'Zipped generated files (job_id={self.job_id})')

    def _serialize_report(self, report_serializer: ReportXmlSerializer) -> Iterator[Any]:
        yield _XmlEvents([
            (XmlWriterEvent.START, 'project'),
            (XmlWriterEvent.ATTR, 'id', self.job_id),
            (XmlWriterEvent.ATTR, 'name', f'{self._job.name} [Generated by Six]'),
            (XmlWriterEvent.ATTR, 'reportVersion', SETTINGS.REPORT_VERSION),
            (XmlWriterEvent.ATTR, 'licenseID', 'SiX'),
            (XmlWriterEvent.ATTR, 'extractionType', 'Physical'),
            (XmlWriterEvent.ATTR, 'containsGarbage', 'false')
        ])
        yield create_source_extractions()
        yield create_case_information()
        yield self._create_device_info_metadata()
        yield Images()
        yield from self._serialize_tagged_files()
        yield from self._serialize_decoded_data(report_serializer=report_serializer)
        yield from self._create_extra_infos()
        yield create_project_configurations()
        yield _XmlEvents([(XmlWriterEvent.END, 'project')])

    def _create_device_info_metadata(self) -> Metadata:
        device_info = db.read_device_info(self.job_id)
        metadata = create_device_info_metadata(device_info=device_info)
        return metadata

    def _serialize_tagged_files(self) -> Iterator[Any]:
        yield _XmlEvents([(XmlWriterEvent.START, 'taggedFiles')])
        for file_data in self._file_data_iterator():
            file = ReportFileSerializer.serialize(context=self._context, file_data=file_data)
            self._file_counts[file_data.data_type] += 1
            yield file
        yield _XmlEvents([(XmlWriterEvent.END, 'taggedFiles')])

    def _serialize_decoded_data(self, report_serializer: ReportXmlSerializer) -> Iterator[Any]:
        # Retrieve all event types of simulated events
        event_types = db.get_all_event_types(job_id=self.job_id)
        # Filter out file event types, they are handled in the taggedFiles serializer
        event_types = filter(lambda event_type: event_type not in FILE_EVENT_TYPES, event_types)
        # Mapping of model type to job's event type
        model_type_to_event_type = {event_type_to_model_type[event_type]: event_type for event_type in event_types}
        # Mapping of model type to user's custom report models
        model_type_to_custom_models = generate_custom_models(custom_events=self._job.custom_events)
        # All relevant model types to job (from both simulated and user events)
        all_model_types = sorted(model_type_to_event_type.keys() | model_type_to_custom_models.keys())

        yield _XmlEvents([(XmlWriterEvent.START, 'decodedData')])

        for model_type in all_model_types:
            event_type = model_type_to_event_type.get(model_type)
            custom_models = model_type_to_custom_models.get(model_type, [])
            model_iter = self._serialize_model_type(model_type=model_type, event_type=event_type,
                                                    custom_models=custom_models, report_serializer=report_serializer)
            # Verify model type has at least 1 model and if so then serialize its start/end xml tags.
            #   This prevents empty tag (e.g., <modelType type="Contact"/>) in case where events are only sub-events
            if (model := next(model_iter, None)) is not None:
                yield _XmlEvents([
                    (XmlWriterEvent.START, 'modelType'),
                    (XmlWriterEvent.ATTR, 'type', model_type)
                ])
                yield model
                yield from model_iter
                yield _XmlEvents([(XmlWriterEvent.END, 'modelType')])

        yield _XmlEvents([(XmlWriterEvent.END, 'decodedData')])

    def _serialize_model_type(
            self,
            model_type: str,
            event_type: EventType | None,
            custom_models: list[Event],
            report_serializer: ReportXmlSerializer
    ) -> Iterator[Any]:
        # Serialize custom events
        yield from custom_models
        self._model_counts[model_type] += len(custom_models)    # For manifest

        # Serialize simulated events
        if event_type is None:
            return    # Model type was associated from custom events only

        serializer = get_serializer(event_type=event_type)
        if event_type is EventType.CHAT:
            yield from self._serialize_chat_model_type(model_type=model_type, serializer=serializer,
                                                       report_serializer=report_serializer)
        else:
            yield from self._serialize_non_chat_model_type(model_type=model_type, event_type=event_type,
                                                           serializer=serializer)

    def _serialize_non_chat_model_type(
            self,
            model_type: str,
            event_type: EventType,
            serializer: type[ReportModelSerializer]
    ) -> Iterator[Event]:
        events = db.read_events(job_id=self.job_id, event_type=event_type, include_nested_models=False)
        num_events = 0
        for num_events, event in enumerate(events, 1):
            model = serializer.serialize_event(self._context, event)
            yield model
        self._model_counts[model_type] += num_events    # For manifest

    def _serialize_chat_model_type(
            self,
            model_type: str,
            serializer: type[ReportModelSerializer],
            report_serializer: ReportXmlSerializer
    ) -> Iterator[Event | _XmlEvents | EventField]:
        message_serializer = get_serializer(EventType.INSTANT_MESSAGE)
        chats = db.read_chat_events_without_messages(job_id=self.job_id)
        num_chats = 0
        for num_chats, chat in enumerate(chats, 1):
            # Yield all events before end tag in order to inject message events
            chat_event = serializer.serialize_event(self._context, chat, skip_messages=True)
            chat_xml_events_without_messages = list(report_serializer.write_object(chat_event))
            chat_xml_events_preamble = _XmlEvents(chat_xml_events_without_messages[:-1])    # take all except last tag
            yield chat_xml_events_preamble

            # Message events
            yield _XmlEvents([      # "Messages" multiModeField preamble
                (XmlWriterEvent.START, 'multiModelField'),
                (XmlWriterEvent.ATTR, 'name', 'Messages'),
                (XmlWriterEvent.ATTR, 'type', 'InstantMessage')
            ])
            messages = db.read_chat_messages(job_id=self.job_id, chat_uid=chat.uid)
            num_messages = 0
            message = first_message = next(messages, None)
            if first_message is not None:   # at least 1 message exists in Chat
                yield message_serializer.serialize_event(self._context, first_message, chat=chat)
                num_messages = 1
                for num_messages, message in enumerate(messages, 2):    # start from 2 because we already have first msg
                    yield message_serializer.serialize_event(self._context, message, chat=chat)
            yield _XmlEvents([(XmlWriterEvent.END, 'multiModelField')])      # "Messages" multiModeField end tag

            # Chat fields that depend on first/last messages iterator
            if message is not None:     # at least 1 message exists in Chat
                yield TimeField(name="StartTime", value=first_message.time)
                yield TimeField(name="LastActivity", value=message.time)

            yield _XmlEvents([chat_xml_events_without_messages[-1]])        # Chat model end tag
            self._model_counts['ChatMessage'] += num_messages   # For manifest

        self._model_counts[model_type] += num_chats     # For manifest

    def _create_extra_infos(self) -> Iterator[Any]:
        yield _XmlEvents([(XmlWriterEvent.START, 'extraInfos')])

        event_types = db.get_all_event_types(job_id=self.job_id)
        for event_type in event_types:
            get_extra_info_func = get_file_extra_info if event_type in FILE_EVENT_TYPES else get_model_extra_info
            event_ids = db.read_event_ids(job_id=self.job_id, event_type=event_type)
            yield from map(get_extra_info_func, event_ids)

        yield _XmlEvents([(XmlWriterEvent.END, 'extraInfos')])
