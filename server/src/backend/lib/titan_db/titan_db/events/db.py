import itertools
import json
import sys
from functools import wraps
from itertools import groupby
from types import GeneratorType
from typing import Iterator, NamedTuple

import pymongo
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import InvalidOperation, OperationFailure

from core.config import SETTINGS
from core.titan_logger import logger
from model.types import FILE_EVENT_TYPES, Chat, ChatMessage, DeviceInfo, EventType, FileData, GeneratedData, \
    InstalledApplication, Location, get_generated_data_class

MONGO_DB_NAME = "titan"
GRAPH_CHUNK_SIZE = 200_000
SOCIAL_CONTEXT_WEIGHTS_CLASS_NAME = "weights"
SOCIAL_CONTEXT_LOCATIONS_CLASS_NAME = "SC_Locations"
MAX_DOC_CHUNK_SIZE_BYTES = 16_000_000  # <16MB to account for chunk metadata overhead
CHILD_EVENT_RETRIEVAL_BATCH_SIZE = 5_000

_FIELD_TASK_ID = "task_id"
_FIELD_EVENT_TYPE = "event_type"
FIELD_CLASS_NAME = "class_name"

# When a document is too large to be written to the DB, it will be chunked into multiple documents.
# The original document will be replaced with a parent document containing metadata about the chunked document.
# These fields (if they exist in original doc) should be copied to the parent to allow for querying by various fields.
_COPY_FIELDS_TO_CHUNK_PARENT = {
    _FIELD_TASK_ID,
    _FIELD_EVENT_TYPE,
    FIELD_CLASS_NAME,
    "app_id",
    "app_uid",
    "chat_uid",
    "is_attachment",
    "is_sub_event",
    "uid",
}

QUERY_FILTERS = {"_id": 0, FIELD_CLASS_NAME: 0, _FIELD_TASK_ID: 0, _FIELD_EVENT_TYPE: 0}


def construct_db_url() -> str:
    if SETTINGS.DEPLOYMENT == "local":
        return f"mongodb://{SETTINGS.DB_DOCUMENT_DB_URL}/"
    return f"mongodb://{SETTINGS.DB_DOCUMENT_DB_USER}:{SETTINGS.DB_DOCUMENT_DB_PASSWORD}@{SETTINGS.DB_DOCUMENT_DB_URL}/?tls=true&tlsCAFile={SETTINGS.DB_DOCUMENT_DB_CERT_PATH}&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false&tlsAllowInvalidHostnames=true"


class GeneratedDataDbError(Exception):
    def __init__(self, job_id: str, message: str):
        self.job_id = job_id
        self.message = message
        super().__init__(f"Error in DB for job {job_id}: {message}")

    def __reduce__(self):  # Resolves pickling error when celery task returns exception
        return GeneratedDataDbError, (self.job_id, self.message)


class GeneratedTaskData(NamedTuple):
    data: GeneratedData
    task_id: str


def job_db_session(func):
    @wraps(func)
    def inner(job_id: str, *args, **kwargs):
        try:
            with MongoClient(construct_db_url()) as client:
                job_collection = client[MONGO_DB_NAME][job_id]
                ret = func(job_id=job_id, *args, **kwargs, job_collection=job_collection)
                if isinstance(ret, GeneratorType):  # needed to catch exceptions in decorator when iteration consumption

                    def generator_wrapper():  # extra wrapper for @job_db_session methods that return generators
                        try:
                            yield from ret
                        except GeneratedDataDbError as e:
                            raise e
                        except Exception as e:
                            raise GeneratedDataDbError(job_id=job_id, message=f"[{type(e).__name__}] {e}")

                    return generator_wrapper()
                else:
                    return ret
        except GeneratedDataDbError as e:
            raise e
        except Exception as e:
            raise GeneratedDataDbError(job_id=job_id, message=f"[{type(e).__name__}] {e}")

    return inner


@job_db_session
def initialize_job_collection(job_id: str, job_collection: Collection = None) -> None:
    try:
        job_collection.create_index(FIELD_CLASS_NAME)
        job_collection.create_index("app_id", sparse=True)  # for task's custom user app retrieval
        job_collection.create_index("chat_uid", sparse=True)  # for reading Chat events
    except GeneratedDataDbError as e:
        raise e
    except Exception as e:
        logger.error("Error initializing DB for job", job_id=job_id)
        raise GeneratedDataDbError(job_id=job_id, message=str(e))


@job_db_session
def write_device_info(job_id: str, device_info: DeviceInfo, job_collection: Collection = None):
    logger.info(f"Writing device info for job {job_id}")
    serialized_data = serialize(data=device_info)
    job_collection.insert_one(serialized_data)
    logger.info("Device info saved")


@job_db_session
def read_device_info(job_id: str, job_collection: Collection = None) -> DeviceInfo:
    device_info = next(_read_data(job_collection=job_collection, data_class=DeviceInfo))
    return device_info


@job_db_session
def read_app_by_appid(job_id: str, app_id: str, job_collection: Collection = None) -> InstalledApplication | None:
    query = {"app_id": app_id}
    app_data_dict = job_collection.find_one(query, QUERY_FILTERS)
    if app_data_dict is None:
        return None
    app = InstalledApplication.model_validate(app_data_dict)
    return app


@job_db_session
def get_random_apps_by_event_type(
    job_id: str, event_type: EventType, sample: int, job_collection: Collection = None
) -> list[InstalledApplication]:
    query = [  # TODO doesn't work, verify query
        {
            "$match": {
                FIELD_CLASS_NAME: InstalledApplication.__name__,
                "event_types": {"$elemMatch": {"$eq": event_type.value}},
            }
        },
        {"$sample": {"size": sample}},
        {"$project": QUERY_FILTERS},
    ]
    app_data_dict_iter = job_collection.aggregate(query, allowDiskUse=True)
    apps = list(
        _parse_query_results(
            job_collection=job_collection, data_dict_iter=app_data_dict_iter, data_class=InstalledApplication
        )
    )
    return apps


@job_db_session
def read_referenced_apps(job_id: str, job_collection: Collection = None) -> Iterator[InstalledApplication]:
    referenced_app_uids = list(job_collection.distinct("app_uid", filter={"app_uid": {"$ne": None}}))
    if not referenced_app_uids:
        return iter(())
    app_data_dict_iter = job_collection.find({"_id": {"$in": referenced_app_uids}})
    apps = _parse_query_results(
        job_collection=job_collection, data_dict_iter=app_data_dict_iter, data_class=InstalledApplication
    )
    return apps


@job_db_session
def read_event_ids(job_id: str, event_type: EventType, job_collection: Collection = None) -> Iterator[str]:
    data_class = get_generated_data_class(event_type)
    query = {FIELD_CLASS_NAME: data_class.__name__, "is_sub_event": False}
    filters = {"_id": 1}
    uid_dict_iter = job_collection.find(query, filters)
    for uid_dict in uid_dict_iter:
        yield uid_dict["_id"]


@job_db_session
def write_task_events(job_id: str, events: Iterator[GeneratedTaskData], job_collection: Collection = None) -> None:
    data = itertools.chain.from_iterable(
        map(lambda event: _serialize_event(event=event.data, task_id=event.task_id), events)
    )

    id_to_doc = {doc["_id"]: doc for doc in data}  # If insert fails, need to lookup oversized doc by ID to re-insert
    if not id_to_doc:  # Check if there are no events to write
        return
    oversized_docs_chunks = []

    while True:
        try:
            job_collection.insert_many(itertools.chain(id_to_doc.values(), oversized_docs_chunks), ordered=False)
            return
        except InvalidOperation as e:
            if e._message != "No operations to execute":  # ignore PyMongo error if iterator has no events
                raise e
            return  # fail-safe to avoid infinite loop
        except OperationFailure as e:
            # Handle oversized event documents that were attempted to be written to the DB or re-raise error
            # In this case, all other valid documents were not written so need to chunk bad docs and re-run loop
            if e.code != 10334:  # BSONObjectTooLarge error code
                raise e
            errmsg = e.details.get("errmsg")
            logger.debug(f"OperationFailure (BSONObjectTooLarge): {e}")
            try:
                oversized_doc_id = errmsg[
                    errmsg.rindex('"', 0, -1) + 1 : -1
                ]  # Parse oversized doc _id from error message
                oversized_doc = id_to_doc[oversized_doc_id]
                logger.debug(
                    f'Bulk insert failed due to oversized "{oversized_doc[_FIELD_EVENT_TYPE]}" document'
                    f" [id={oversized_doc_id}] (task_id={oversized_doc[_FIELD_TASK_ID]})"
                )
                oversized_doc_parent, oversized_doc_chunks = _get_oversized_doc_chunks(doc=oversized_doc)
                id_to_doc[oversized_doc_id] = oversized_doc_parent  # Replace oversized doc with chunk parent (metadata)
                oversized_docs_chunks.extend(oversized_doc_chunks)
                # Don't do anything here so loop will run another iteration and retry docs and chunks.
            except Exception as exc:  # Sometimes occurs when unable to parse _id that does not appear in errms
                logger.error(f"Failed to handle oversized document error: [{type(exc).__name__}] {exc}")
                raise e  # Raise original error if failed to handle oversized doc error


def _get_oversized_doc_chunks(doc: dict) -> tuple[dict, list[dict]]:
    doc_json_bytes = json.dumps(doc).encode("utf-8")

    chunked_docs = [
        {"_id": f"{doc['_id']}_{c}", "chunk": doc_json_bytes[i : i + MAX_DOC_CHUNK_SIZE_BYTES]}
        for c, i in enumerate(range(0, len(doc_json_bytes), MAX_DOC_CHUNK_SIZE_BYTES))
    ]

    parent_chunk = {"_id": doc["_id"], "chunked": True, "n_chunks": len(chunked_docs)}
    for field in _COPY_FIELDS_TO_CHUNK_PARENT:
        if field in doc:
            parent_chunk[field] = doc[field]

    return parent_chunk, chunked_docs


@job_db_session
def write_events(
    job_id: str, events: Iterator[GeneratedData], task_id: str | None = None, job_collection: Collection = None
) -> int:
    data = itertools.chain.from_iterable(map(lambda event: _serialize_event(event=event, task_id=task_id), events))
    try:
        result = job_collection.insert_many(data, ordered=False)
        return len(result.inserted_ids)
    except InvalidOperation as e:
        if str(e) == "No operations to execute":  # ignore PyMongo error if iterator has no events
            return 0
        raise e


def _serialize_event(event: GeneratedData, task_id: str | None) -> Iterator[dict]:
    serialized_data = serialize(data=event, task_id=task_id)

    for attr_model in event.foreign_fields:
        attr_data = getattr(event, attr_model)
        if attr_data:
            if isinstance(attr_data, list):
                serialized_data[attr_model] = [e.uid for e in attr_data]
            else:
                serialized_data[attr_model] = attr_data.uid

    yield serialized_data

    if isinstance(event, Chat):
        for message in event.messages:
            yield from _serialize_event(event=message, task_id=task_id)


@job_db_session
def read_events(
    job_id: str,
    event_type: EventType,
    task_id: str = None,
    include_attachments: bool = True,
    include_nested_models: bool = True,
    job_collection: Collection = None,
) -> Iterator[GeneratedData]:
    if event_type is EventType.CHAT:
        events = _read_chat_events(job_collection=job_collection, task_id=task_id)
    else:
        events = _read_events(
            job_collection=job_collection,
            event_type=event_type,
            task_id=task_id,
            include_attachments=include_attachments,
            include_nested_models=include_nested_models,
        )
    return events


@job_db_session
def read_chat_events_without_messages(job_id: str, job_collection: Collection = None) -> Iterator[Chat]:
    query = {FIELD_CLASS_NAME: Chat.__name__}
    filters = {"messages": 0, **QUERY_FILTERS}
    chat_dict_iter = job_collection.find(query, filters).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)
    return _parse_query_results(job_collection=job_collection, data_dict_iter=chat_dict_iter, data_class=Chat)


@job_db_session
def read_chat_messages(job_id: str, chat_uid: str, job_collection: Collection = None) -> Iterator[ChatMessage]:
    return _read_chat_messages(job_collection=job_collection, chat_uid=chat_uid)


def _read_events_by_uids(job_collection: Collection, uids: list[str]) -> list[GeneratedData]:
    query = {"_id": {"$in": uids}}
    filters = {"_id": 0, _FIELD_TASK_ID: 0, _FIELD_EVENT_TYPE: 0}
    data_dict_iter = job_collection.find(query, filters).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)
    sorted_data_dicts = sorted(data_dict_iter, key=lambda data_dict: data_dict[FIELD_CLASS_NAME])
    data = []
    for class_name, data_dict_group in groupby(
        sorted_data_dicts, key=lambda data_dict: data_dict.pop(FIELD_CLASS_NAME)
    ):
        data_class = getattr(sys.modules["model.types"], class_name)
        data.extend(
            _parse_query_results(job_collection=job_collection, data_dict_iter=data_dict_group, data_class=data_class)
        )

    return data


@job_db_session
def read_locations_by_id_range(
    job_id: str, first_id: str, last_id: str, job_collection: Collection = None
) -> Iterator[Location]:
    id_range_query = {"_id": {"$gte": first_id, "$lte": last_id}}
    location_data_dict_iter = job_collection.find(id_range_query, QUERY_FILTERS).batch_size(
        SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE
    )
    return _parse_query_results(
        job_collection=job_collection, data_dict_iter=location_data_dict_iter, data_class=Location
    )


def _read_events(
    job_collection: Collection,
    event_type: EventType,
    task_id: str = None,
    include_attachments: bool = True,
    include_nested_models: bool = True,
) -> Iterator[GeneratedData]:
    event_class = get_generated_data_class(event_type)
    return _read_data(
        job_collection=job_collection,
        data_class=event_class,
        task_id=task_id,
        include_attachments=include_attachments,
        include_nested_models=include_nested_models,
    )


def _read_data[GD: GeneratedData](
    job_collection: Collection,
    data_class: type[GD],
    task_id: str = None,
    include_attachments: bool = True,
    include_nested_models: bool = True,
) -> Iterator[GD]:
    return _deserialize_data(
        job_collection=job_collection,
        data_class=data_class,
        task_id=task_id,
        include_attachments=include_attachments,
        include_nested_models=include_nested_models,
    )


def _read_chat_events(job_collection: Collection, task_id: str = None) -> Iterator[Chat]:
    chats = _read_events(job_collection=job_collection, event_type=EventType.CHAT, task_id=task_id)
    for chat in chats:
        chat.messages = list(_read_chat_messages(job_collection=job_collection, chat_uid=chat.uid))
        yield chat


def _read_chat_messages(job_collection: Collection, chat_uid: str) -> Iterator[ChatMessage]:
    query = {FIELD_CLASS_NAME: ChatMessage.__name__, "chat_uid": chat_uid}
    message_dict_iter = (
        job_collection.find(query, QUERY_FILTERS)
        .sort("time", pymongo.ASCENDING)
        .batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)
    )
    return _parse_query_results(job_collection=job_collection, data_dict_iter=message_dict_iter, data_class=ChatMessage)


@job_db_session
def sample_events(
    job_id: str, event_types: set[EventType], sample: int, job_collection: Collection = None
) -> Iterator[GeneratedData]:
    class_names = [get_generated_data_class(event_type).__name__ for event_type in event_types]
    filters = {"_id": 0, _FIELD_TASK_ID: 0, _FIELD_EVENT_TYPE: 0}
    query = [{"$match": {FIELD_CLASS_NAME: {"$in": class_names}}}, {"$sample": {"size": sample}}, {"$project": filters}]
    data_dict_iter = job_collection.aggregate(query, batchSize=SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE, allowDiskUse=True)
    for data_dict in data_dict_iter:
        data_class = getattr(sys.modules["model.types"], data_dict.pop(FIELD_CLASS_NAME))
        data = data_class.model_validate(data_dict)
        yield data


@job_db_session
def get_all_event_types(job_id: str, job_collection: Collection = None) -> list[EventType]:
    event_types = []
    for name in job_collection.distinct(_FIELD_EVENT_TYPE):
        try:
            event_types.append(EventType(name))
        except ValueError:
            continue
    return event_types


@job_db_session
def read_file_events(job_id: str, sort_by_size: bool = False, job_collection: Collection = None) -> Iterator[FileData]:
    for event_type in FILE_EVENT_TYPES:
        data_class = get_generated_data_class(event_type)
        yield from _deserialize_file_data(
            job_collection=job_collection, data_class=data_class, sort_by_size=sort_by_size
        )


def _deserialize_data[GD: GeneratedData](
    job_collection: Collection,
    data_class: type[GD],
    task_id: str = None,
    include_attachments: bool = True,
    include_nested_models: bool = True,
) -> Iterator[GD]:
    query = {FIELD_CLASS_NAME: data_class.__name__}
    if task_id:
        query[_FIELD_TASK_ID] = task_id
    if not include_attachments:
        query["is_attachment"] = False
    if not include_nested_models:
        query["is_nested_data"] = False

    data_dict_iter = job_collection.find(
        query,
        QUERY_FILTERS,
    ).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)

    return _parse_query_results(job_collection=job_collection, data_dict_iter=data_dict_iter, data_class=data_class)


def _deserialize_file_data[FD: FileData](
    job_collection: Collection, data_class: type[FD], sort_by_size: bool = False
) -> Iterator[FD]:
    query = {FIELD_CLASS_NAME: data_class.__name__}
    data_dict_iter = job_collection.find(
        query,
        QUERY_FILTERS,
    ).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)

    if sort_by_size:
        data_dict_iter = data_dict_iter.sort("size", pymongo.ASCENDING)

    return _parse_query_results(job_collection=job_collection, data_dict_iter=data_dict_iter, data_class=data_class)


def delete_job(job_id: str, raise_error_on_missing: bool = True) -> None:
    try:
        with MongoClient(construct_db_url()) as client:
            db = client[MONGO_DB_NAME]
            if job_id not in db.list_collection_names():
                if raise_error_on_missing:
                    raise GeneratedDataDbError(job_id=job_id, message="Cannot delete job, job collection doesn't exist")
                return
            job_collection = db[job_id]
            job_collection.drop()
    except Exception as e:
        raise GeneratedDataDbError(job_id=job_id, message=str(e))


def _deserialize_child_events(job_collection: Collection, data_class: type[GeneratedData], data: dict) -> dict:
    # Return data if primitive type or None
    if type(data) in (int, float, bool, str) or data is None:
        return data

    for attr_model in data_class.foreign_fields:
        # If attribute type is subclass of GeneratedData itself call _deserialize_child_events
        event_uids = data.get(attr_model)
        if event_uids:
            if isinstance(event_uids, list):
                if len(event_uids) <= CHILD_EVENT_RETRIEVAL_BATCH_SIZE:
                    data[attr_model] = _read_events_by_uids(job_collection=job_collection, uids=event_uids)
                else:  # Retrieve child events in batches, too many UIDs
                    data[attr_model] = list(
                        itertools.chain.from_iterable(
                            _read_events_by_uids(
                                job_collection=job_collection, uids=event_uids[i : i + CHILD_EVENT_RETRIEVAL_BATCH_SIZE]
                            )
                            for i in range(0, len(event_uids), CHILD_EVENT_RETRIEVAL_BATCH_SIZE)
                        )
                    )
            else:
                events = _read_events_by_uids(job_collection=job_collection, uids=[event_uids])
                data[attr_model] = events[0] if events else events

    return data


def _parse_query_results[GD: GeneratedData](
        job_collection: Collection,
        data_dict_iter: Iterator[dict],
        data_class: type[GD]
) -> Iterator[GD]:
    for data_dict in data_dict_iter:
        if data_dict.get("chunked"):
            data_dict = _assemble_chunked_data(job_collection=job_collection, data_dict=data_dict)
        data_dict = _deserialize_child_events(job_collection=job_collection, data=data_dict, data_class=data_class)
        data = data_class.model_validate(data_dict)
        yield data


def _assemble_chunked_data(job_collection: Collection, data_dict: dict) -> dict:
    n_chunks = data_dict["n_chunks"]
    chunks_ids = [f"{data_dict['uid']}_{i}" for i in range(n_chunks)]
    chunk_docs = job_collection.find({"_id": {"$in": chunks_ids}}, {"chunk": 1})
    chunks = [chunk["chunk"] for chunk in chunk_docs]
    assembled_data_dict = json.loads(b"".join(chunks).decode("utf-8"))
    return assembled_data_dict


def serialize(data: GeneratedData, task_id: str = None) -> dict:
    serialized_data = data.model_dump(mode='json', exclude=data.foreign_fields)
    serialized_data[FIELD_CLASS_NAME] = data.__repr_name__()
    serialized_data['_id'] = data.uid
    if data.event_type:
        serialized_data[_FIELD_EVENT_TYPE] = data.event_type.value
    if task_id:
        serialized_data[_FIELD_TASK_ID] = task_id
    return serialized_data
