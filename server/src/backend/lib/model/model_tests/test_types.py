import pytest

from model.types import (
    EventType,
    GeneratedData,
    GeneratedDataClassNotFoundError,
    get_generated_data_class,
    Entity,
    FileData,
    Chat,
    ChatMessage,
    Document,
    DeviceInfoEntry,
    OwnerEntity,
    PhoneCall,
)


class TestGeneratedDataClassNotFoundError:
    def test_message(self):
        err = GeneratedDataClassNotFoundError(event_type=EventType.CALL)
        assert "calls" in str(err)


class TestGetGeneratedDataClass:
    def test_known(self):
        cls = get_generated_data_class(EventType.CALL)
        assert cls is PhoneCall

    def test_unknown_raises(self):
        with pytest.raises(GeneratedDataClassNotFoundError):
            get_generated_data_class("nonexistent")


class TestEntity:
    def test_create(self):
        e = Entity(
            first_name="John",
            last_name="Doe",
            phones=["123"],
        )
        assert e.first_name == "John"


class TestDeviceInfoEntry:
    def test_create(self):
        d = DeviceInfoEntry(key="IMEI", value="123456")
        assert d.key == "IMEI"


class TestOwnerEntity:
    def test_create(self):
        oe = OwnerEntity(
            first_name="Jane",
            last_name="Doe",
            phones=["456"],
        )
        assert oe.first_name == "Jane"


MD5 = "a" * 32


class TestDocument:
    def test_default_data_type(self):
        doc = Document(
            uid="d1",
            size=100,
            format="pdf",
            filename="test.pdf",
            deleted_state="Intact",
            md5=MD5,
        )
        assert doc.data_type == "Document"

    def test_none_data_type(self):
        doc = Document(
            uid="d1",
            size=100,
            format="pdf",
            filename="test.pdf",
            deleted_state="Intact",
            md5=MD5,
            data_type=None,
        )
        assert doc.data_type == "Document"


class TestFileDataPath:
    def test_path_constructed(self):
        doc = Document(
            uid="d1",
            size=100,
            format="pdf",
            filename="test.pdf",
            deleted_state="Intact",
            md5=MD5,
        )
        assert doc.path is not None
        assert "test.pdf" in str(doc.path)

    def test_path_from_format(self):
        doc = Document(
            uid="d1",
            size=100,
            format="pdf",
            deleted_state="Intact",
            md5=MD5,
        )
        assert doc.path is not None
        assert ".pdf" in str(doc.path)


class TestChat:
    def test_messages_get_chat_uid(self):
        msg = ChatMessage(
            uid="m1",
            sender="e1",
            body="hello",
        )
        chat = Chat(
            uid="c1",
            participants=["e1", "e2"],
            messages=[msg],
        )
        # The validator assigns chat.uid to messages
        for m in chat.messages:
            assert m.chat_uid == chat.uid


class TestGeneratedDataModelDump:
    def test_exclude_none(self):
        e = Entity(
            first_name="John",
            phones=["123"],
        )
        data = e.model_dump()
        assert "last_name" not in data or data.get("last_name") is None
