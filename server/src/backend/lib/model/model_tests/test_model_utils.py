from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel, TypeAdapter

from model.utils import (
    AbstractData,
    str_uuid,
    ignore_and_generate_uid,
    deserialize,
    now,
)


class TestStrUuid:
    def test_returns_string(self):
        uid = str_uuid()
        assert isinstance(uid, str)
        assert len(uid) == 36  # UUID format

    def test_unique(self):
        assert str_uuid() != str_uuid()


class TestIgnoreAndGenerateUid:
    def test_generates_new_uid_without_context(self):
        info = MagicMock()
        info.context = None
        result = ignore_and_generate_uid("old_value", info)
        assert isinstance(result, str)
        assert len(result) == 36

    def test_keeps_value_from_db(self):
        info = MagicMock()
        info.context = {"source": "db"}
        result = ignore_and_generate_uid("existing-id", info)
        assert result == "existing-id"

    def test_generates_new_uid_with_non_db_context(self):
        info = MagicMock()
        info.context = {"source": "api"}
        result = ignore_and_generate_uid("old_value", info)
        assert result != "old_value"
        assert len(result) == 36


class TestAbstractData:
    def test_model_dump_excludes_none(self):
        class MyData(AbstractData):
            name: str
            value: str | None = None

        d = MyData(name="test")
        dumped = d.model_dump()
        assert "value" not in dumped
        assert dumped["name"] == "test"

    def test_model_dump_json_excludes_none(self):
        class MyData(AbstractData):
            name: str
            value: str | None = None

        d = MyData(name="test")
        json_str = d.model_dump_json()
        assert "value" not in json_str
        assert "test" in json_str


class SampleModel(BaseModel):
    name: str
    count: int = 0


class TestDeserialize:
    def test_with_base_model(self):
        result = deserialize({"name": "foo", "count": 5}, SampleModel)
        assert result.name == "foo"
        assert result.count == 5

    def test_with_type_adapter(self):
        adapter = TypeAdapter(SampleModel)
        result = deserialize({"name": "bar"}, adapter)
        assert result.name == "bar"

    def test_with_invalid_model_type(self):
        with pytest.raises(TypeError, match="must be a Pydantic BaseModel"):
            deserialize({"name": "test"}, str)


class TestNow:
    def test_returns_utc(self):
        result = now()
        assert isinstance(result, datetime)
        assert result.tzinfo == timezone.utc
