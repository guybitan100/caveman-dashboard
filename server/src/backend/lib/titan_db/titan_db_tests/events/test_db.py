from unittest.mock import patch, MagicMock, PropertyMock
import json
import sys

import pytest
from pymongo.errors import InvalidOperation, OperationFailure

from titan_db.events.db import (
    construct_db_url,
    GeneratedDataDbError,
    GeneratedTaskData,
    serialize,
    _get_oversized_doc_chunks,
    _serialize_event,
    _deserialize_child_events,
    _parse_query_results,
    _assemble_chunked_data,
    _read_events_by_uids,
    FIELD_CLASS_NAME,
    _FIELD_EVENT_TYPE,
    _FIELD_TASK_ID,
    _COPY_FIELDS_TO_CHUNK_PARENT,
    MAX_DOC_CHUNK_SIZE_BYTES,
    CHILD_EVENT_RETRIEVAL_BATCH_SIZE,
    job_db_session,
    delete_job,
    initialize_job_collection,
    write_device_info,
    read_device_info,
    read_app_by_appid,
    get_random_apps_by_event_type,
    read_referenced_apps,
    read_event_ids,
    write_task_events,
    write_events,
    read_events,
    read_chat_events_without_messages,
    read_chat_messages,
    read_locations_by_id_range,
    sample_events,
    get_all_event_types,
    read_file_events,
)


class TestConstructDbUrl:
    @patch("titan_db.events.db.SETTINGS", MagicMock(
        DEPLOYMENT="local",
        DB_DOCUMENT_DB_URL="localhost:27017",
    ))
    def test_local(self):
        url = construct_db_url()
        assert url == "mongodb://localhost:27017/"

    @patch("titan_db.events.db.SETTINGS", MagicMock(
        DEPLOYMENT="aws",
        DB_DOCUMENT_DB_USER="user",
        DB_DOCUMENT_DB_PASSWORD="pass",
        DB_DOCUMENT_DB_URL="docdb.host:27017",
        DB_DOCUMENT_DB_CERT_PATH="/cert.pem",
    ))
    def test_aws(self):
        url = construct_db_url()
        assert "docdb.host:27017" in url
        assert "tls=true" in url
        assert "user:pass" in url


class TestGeneratedDataDbError:
    def test_message(self):
        err = GeneratedDataDbError(job_id="j1", message="boom")
        assert "j1" in str(err)
        assert "boom" in str(err)

    def test_reduce(self):
        err = GeneratedDataDbError(job_id="j1", message="boom")
        cls, args = err.__reduce__()
        assert cls is GeneratedDataDbError
        assert args == ("j1", "boom")


class TestSerialize:
    def test_basic(self):
        data = MagicMock()
        data.model_dump.return_value = {"uid": "u1", "name": "test"}
        data.foreign_fields = set()
        data.__repr_name__ = MagicMock(return_value="TestClass")
        data.uid = "u1"
        data.event_type = None
        result = serialize(data=data)
        assert result[FIELD_CLASS_NAME] == "TestClass"
        assert result["_id"] == "u1"
        assert _FIELD_TASK_ID not in result

    def test_with_task_id(self):
        data = MagicMock()
        data.model_dump.return_value = {"uid": "u1"}
        data.foreign_fields = set()
        data.__repr_name__ = MagicMock(return_value="Cls")
        data.uid = "u1"
        data.event_type = MagicMock(value="calls")
        result = serialize(data=data, task_id="t1")
        assert result[_FIELD_TASK_ID] == "t1"
        assert result[_FIELD_EVENT_TYPE] == "calls"


class TestGetOversizedDocChunks:
    def test_chunking(self):
        doc = {"_id": "doc1", "task_id": "t1", "event_type": "calls", "data": "x" * 100}
        parent, chunks = _get_oversized_doc_chunks(doc)
        assert parent["_id"] == "doc1"
        assert parent["chunked"] is True
        assert parent["n_chunks"] == len(chunks)
        assert parent["task_id"] == "t1"

    def test_large_doc_multiple_chunks(self):
        big_data = "x" * (MAX_DOC_CHUNK_SIZE_BYTES * 3)
        doc = {"_id": "doc2", "data": big_data}
        parent, chunks = _get_oversized_doc_chunks(doc)
        assert len(chunks) >= 3


class TestSerializeEvent:
    def test_simple_event(self):
        event = MagicMock()
        event.model_dump.return_value = {"uid": "u1"}
        event.foreign_fields = set()
        event.__repr_name__ = MagicMock(return_value="TestEvent")
        event.uid = "u1"
        event.event_type = None
        # Check it's a generator
        result = list(_serialize_event(event=event, task_id="t1"))
        assert len(result) >= 1
        assert result[0]["_id"] == "u1"


class TestJobDbSessionDecorator:
    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_wraps_exceptions(self, mock_client, mock_url):
        @job_db_session
        def failing_func(job_id, job_collection=None):
            raise RuntimeError("oops")

        with pytest.raises(GeneratedDataDbError, match="oops"):
            failing_func(job_id="j1")

    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_passes_through(self, mock_client, mock_url):
        @job_db_session
        def ok_func(job_id, job_collection=None):
            return "ok"

        mock_client_instance = MagicMock()
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = ok_func(job_id="j1")
        assert result == "ok"

    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_generator_wrapping(self, mock_client, mock_url):
        @job_db_session
        def gen_func(job_id, job_collection=None):
            yield 1
            yield 2

        mock_client_instance = MagicMock()
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(gen_func(job_id="j1"))
        assert result == [1, 2]


class TestDeleteJob:
    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_delete_existing(self, mock_client, mock_url):
        mock_db = MagicMock()
        mock_db.list_collection_names.return_value = ["j1"]
        mock_client_instance = MagicMock()
        mock_client_instance.__getitem__ = MagicMock(return_value=mock_db)
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        delete_job(job_id="j1")

    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_delete_missing_no_raise(self, mock_client, mock_url):
        mock_db = MagicMock()
        mock_db.list_collection_names.return_value = []
        mock_client_instance = MagicMock()
        mock_client_instance.__getitem__ = MagicMock(return_value=mock_db)
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        delete_job(job_id="j1", raise_error_on_missing=False)

    @patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
    @patch("titan_db.events.db.MongoClient")
    def test_delete_missing_raises(self, mock_client, mock_url):
        mock_db = MagicMock()
        mock_db.list_collection_names.return_value = []
        mock_client_instance = MagicMock()
        mock_client_instance.__getitem__ = MagicMock(return_value=mock_db)
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        with pytest.raises(GeneratedDataDbError):
            delete_job(job_id="j1", raise_error_on_missing=True)


def _mock_mongo():
    """Helper to setup mocked MongoClient context manager."""
    mock_collection = MagicMock()
    mock_client_instance = MagicMock()
    mock_client_instance.__getitem__ = MagicMock(
        return_value=MagicMock(__getitem__=MagicMock(return_value=mock_collection))
    )
    return mock_collection, mock_client_instance


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestInitializeJobCollection:
    def test_creates_indexes(self, mock_client, mock_url):
        coll = MagicMock()
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        initialize_job_collection(job_id="j1")
        assert coll.create_index.call_count == 3


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestWriteDeviceInfo:
    def test_writes(self, mock_client, mock_url):
        coll = MagicMock()
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        device_info = MagicMock()
        device_info.model_dump.return_value = {"uid": "d1"}
        device_info.foreign_fields = set()
        device_info.__repr_name__ = MagicMock(return_value="DeviceInfo")
        device_info.uid = "d1"
        device_info.event_type = None
        write_device_info(job_id="j1", device_info=device_info)
        coll.insert_one.assert_called_once()


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadAppByAppId:
    def test_found(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find_one.return_value = {"uid": "a1", "app_id": "a1", "name": "App", "event_types": []}
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        with patch("titan_db.events.db.InstalledApplication") as mock_app:
            mock_app.model_validate.return_value = MagicMock()
            result = read_app_by_appid(job_id="j1", app_id="a1")
            assert result is not None

    def test_not_found(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find_one.return_value = None
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = read_app_by_appid(job_id="j1", app_id="a1")
        assert result is None


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestGetRandomAppsByEventType:
    def test_returns_apps(self, mock_client, mock_url):
        coll = MagicMock()
        coll.aggregate.return_value = iter([])
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        from model.types import EventType
        result = get_random_apps_by_event_type(job_id="j1", event_type=EventType.CALL, sample=5)
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadReferencedApps:
    def test_no_uids(self, mock_client, mock_url):
        coll = MagicMock()
        coll.distinct.return_value = []
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(read_referenced_apps(job_id="j1"))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadEventIds:
    def test_yields_ids(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find.return_value = [{"_id": "e1"}, {"_id": "e2"}]
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        from model.types import EventType
        result = list(read_event_ids(job_id="j1", event_type=EventType.CALL))
        assert result == ["e1", "e2"]


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestWriteTaskEvents:
    def test_empty(self, mock_client, mock_url):
        coll = MagicMock()
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        write_task_events(job_id="j1", events=iter([]))

    def test_insert_many(self, mock_client, mock_url):
        coll = MagicMock()
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        event = MagicMock()
        event.model_dump.return_value = {"uid": "u1"}
        event.foreign_fields = set()
        event.__repr_name__ = MagicMock(return_value="TestEvent")
        event.uid = "u1"
        event.event_type = None
        event.__class__.__name__ = "TestEvent"
        td = GeneratedTaskData(data=event, task_id="t1")
        write_task_events(job_id="j1", events=iter([td]))
        coll.insert_many.assert_called_once()

    def test_invalid_operation_no_ops(self, mock_client, mock_url):
        coll = MagicMock()
        coll.insert_many.side_effect = InvalidOperation("No operations to execute")
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        event = MagicMock()
        event.model_dump.return_value = {"uid": "u1"}
        event.foreign_fields = set()
        event.__repr_name__ = MagicMock(return_value="TestEvent")
        event.uid = "u1"
        event.event_type = None
        td = GeneratedTaskData(data=event, task_id="t1")
        write_task_events(job_id="j1", events=iter([td]))


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestWriteEvents:
    def test_writes(self, mock_client, mock_url):
        coll = MagicMock()
        coll.insert_many.return_value = MagicMock(inserted_ids=["a", "b"])
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        event = MagicMock()
        event.model_dump.return_value = {"uid": "u1"}
        event.foreign_fields = set()
        event.__repr_name__ = MagicMock(return_value="Evt")
        event.uid = "u1"
        event.event_type = None
        result = write_events(job_id="j1", events=iter([event]), task_id="t1")
        assert result == 2

    def test_no_ops(self, mock_client, mock_url):
        coll = MagicMock()
        coll.insert_many.side_effect = InvalidOperation("No operations to execute")
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = write_events(job_id="j1", events=iter([]))
        assert result == 0


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadEvents:
    def test_non_chat(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find.return_value = MagicMock(batch_size=MagicMock(return_value=iter([])))
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        from model.types import EventType
        result = list(read_events(job_id="j1", event_type=EventType.CALL))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadChatEventsWithoutMessages:
    def test_returns_empty(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find.return_value = MagicMock(batch_size=MagicMock(return_value=iter([])))
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(read_chat_events_without_messages(job_id="j1"))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadChatMessages:
    def test_returns_empty(self, mock_client, mock_url):
        coll = MagicMock()
        mock_find = MagicMock()
        mock_find.sort.return_value = MagicMock(batch_size=MagicMock(return_value=iter([])))
        coll.find.return_value = mock_find
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(read_chat_messages(job_id="j1", chat_uid="c1"))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadLocationsByIdRange:
    def test_returns_empty(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find.return_value = MagicMock(batch_size=MagicMock(return_value=iter([])))
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(read_locations_by_id_range(job_id="j1", first_id="a", last_id="z"))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestSampleEvents:
    def test_empty(self, mock_client, mock_url):
        coll = MagicMock()
        coll.aggregate.return_value = iter([])
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        from model.types import EventType
        result = list(sample_events(job_id="j1", event_types={EventType.CALL}, sample=5))
        assert result == []


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestGetAllEventTypes:
    def test_returns_types(self, mock_client, mock_url):
        coll = MagicMock()
        coll.distinct.return_value = ["calls", "sms/mms", "unknown_garbage"]
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        from model.types import EventType
        result = get_all_event_types(job_id="j1")
        assert EventType.CALL in result
        assert EventType.INSTANT_MESSAGE in result
        assert len(result) == 2  # unknown_garbage skipped


@patch("titan_db.events.db.construct_db_url", return_value="mongodb://localhost:27017/")
@patch("titan_db.events.db.MongoClient")
class TestReadFileEvents:
    def test_empty(self, mock_client, mock_url):
        coll = MagicMock()
        coll.find.return_value = MagicMock(batch_size=MagicMock(return_value=iter([])))
        mock_ci = MagicMock()
        mock_ci.__getitem__ = MagicMock(return_value=MagicMock(__getitem__=MagicMock(return_value=coll)))
        mock_client.return_value.__enter__ = MagicMock(return_value=mock_ci)
        mock_client.return_value.__exit__ = MagicMock(return_value=False)
        result = list(read_file_events(job_id="j1"))
        assert result == []


class TestDeserializeChildEvents:
    def test_primitive(self):
        result = _deserialize_child_events(job_collection=MagicMock(), data_class=MagicMock(), data=42)
        assert result == 42

    def test_none(self):
        result = _deserialize_child_events(job_collection=MagicMock(), data_class=MagicMock(), data=None)
        assert result is None


class TestParseQueryResults:
    def test_unchunked(self):
        coll = MagicMock()
        data_class = MagicMock()
        data_class.foreign_fields = set()
        data_class.model_validate.return_value = "parsed"
        results = list(_parse_query_results(job_collection=coll, data_dict_iter=[{"uid": "u1"}], data_class=data_class))
        assert results == ["parsed"]

    def test_chunked(self):
        coll = MagicMock()
        orig = {"uid": "u1", "name": "test"}
        encoded = json.dumps(orig).encode("utf-8")
        coll.find.return_value = [{"chunk": encoded}]
        data_class = MagicMock()
        data_class.foreign_fields = set()
        data_class.model_validate.return_value = "parsed"
        results = list(_parse_query_results(
            job_collection=coll,
            data_dict_iter=[{"chunked": True, "n_chunks": 1, "uid": "u1"}],
            data_class=data_class,
        ))
        assert results == ["parsed"]


class TestAssembleChunkedData:
    def test_reassembles(self):
        coll = MagicMock()
        orig = {"uid": "u1", "data": "hello"}
        encoded = json.dumps(orig).encode("utf-8")
        coll.find.return_value = [{"chunk": encoded}]
        result = _assemble_chunked_data(job_collection=coll, data_dict={"n_chunks": 1, "uid": "u1"})
        assert result == orig
