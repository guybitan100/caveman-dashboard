
import pytest

from model.tasks import _discriminate_task_type
from model.types import EventType, FILE_EVENT_TYPES


class TestDiscriminateTaskType:

    def test_file_event_type_returns_file(self):
        for event_type in FILE_EVENT_TYPES:
            data = {'event_type': event_type.value}
            result = _discriminate_task_type(data)
            assert result == 'file', f"Expected 'file' for {event_type.value}, got '{result}'"

    def test_file_event_type_as_enum_returns_file(self):
        for event_type in FILE_EVENT_TYPES:
            data = {'event_type': event_type}
            result = _discriminate_task_type(data)
            assert result == 'file', f"Expected 'file' for {event_type}, got '{result}'"

    def test_non_file_event_type_returns_event(self):
        non_file_event_types = [
            EventType.CHAT,
            EventType.INSTANT_MESSAGE,
            EventType.CONTACT,
            EventType.CALL,
            EventType.LOCATION,
            EventType.EMAIL,
        ]
        for event_type in non_file_event_types:
            # Verify that this is indeed not a file event type
            assert event_type not in FILE_EVENT_TYPES, f"{event_type} should not be in FILE_EVENT_TYPES"

            data = {'event_type': event_type.value}
            result = _discriminate_task_type(data)
            assert result == 'event', f"Expected 'event' for {event_type.value}, got '{result}'"

    def test_non_file_event_type_as_enum_returns_event(self):
        data = {'event_type': EventType.CONTACT}
        result = _discriminate_task_type(data)
        assert result == 'event'

    def test_upload_flag_true_returns_upload(self):
        data = {'is_upload': True}
        result = _discriminate_task_type(data)
        assert result == 'upload'

    def test_upload_flag_false_returns_file(self):
        data = {'is_upload': False}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_invalid_data_raises_error(self):
        with pytest.raises(ValueError, match='Cannot discriminate task type'):
            _discriminate_task_type({})

    def test_all_file_event_types_covered(self):
        expected_file_types = {
            EventType.ARCHIVE,
            EventType.AUDIO,
            EventType.DOCUMENT,
            EventType.IMAGE,
            EventType.VIDEO,
        }
        assert FILE_EVENT_TYPES == expected_file_types, (
            f"FILE_EVENT_TYPES has changed. Expected {expected_file_types}, got {FILE_EVENT_TYPES}"
        )

    def test_string_event_type_images_returns_file(self):
        data = {'event_type': 'images'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_videos_returns_file(self):
        data = {'event_type': 'videos'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_audios_returns_file(self):
        data = {'event_type': 'audios'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_documents_returns_file(self):
        data = {'event_type': 'documents'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_archives_returns_file(self):
        data = {'event_type': 'archives'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_contacts_returns_event(self):
        data = {'event_type': 'contacts'}
        result = _discriminate_task_type(data)
        assert result == 'event'

    def test_string_event_type_chat_messages_returns_event(self):
        data = {'event_type': 'chat messages'}
        result = _discriminate_task_type(data)
        assert result == 'event'


class TestTaskHandleNullTypeJsonSchema:
    def test_no_anyof(self):
        from model.tasks import _handle_null_type_json_schema
        schema = {"type": "string"}
        result = _handle_null_type_json_schema(schema)
        assert result == {"type": "string"}

    def test_anyof_nullable(self):
        from model.tasks import _handle_null_type_json_schema
        schema = {"anyOf": [{"type": "integer"}, {"type": "null"}]}
        result = _handle_null_type_json_schema(schema)
        assert result.get("nullable") is True
        assert "anyOf" not in result

    def test_hidden_widget(self):
        from model.tasks import _handle_null_type_json_schema
        schema = {"anyOf": [{"type": "integer"}, {"type": "null"}], "ui": {"widget": "hidden"}}
        result = _handle_null_type_json_schema(schema)
        assert result.get("type") == "null"


class TestSchemaExtra:
    def test_call_task_schema(self):
        from model.tasks import CallTask
        schema = CallTask.model_json_schema()
        assert "title" in schema

    def test_chat_task_schema(self):
        from model.tasks import ChatTask
        schema = ChatTask.model_json_schema()
        assert "title" in schema


class TestGenerationTask:
    def test_is_sub_task(self):
        from model.tasks import CallTask
        task = CallTask(quantity=5)
        assert task.is_sub_task is False

    def test_get_param_fields(self):
        from model.tasks import CallTask
        fields = CallTask.get_param_fields()
        assert isinstance(fields, set)

    def test_flatten_tasks(self):
        from model.tasks import CallTask
        task = CallTask(quantity=5)
        flat = list(task.flatten_tasks())
        assert len(flat) == 1


class TestChatTask:
    def test_quantity_required(self):
        from model.tasks import ChatTask
        with pytest.raises(ValueError):
            ChatTask(quantity=0, voice_messages_quantity=0)

    def test_with_voice_messages_quantity(self):
        from model.tasks import ChatTask, AudioTask
        # Pass voice_messages_task explicitly as dict to trigger the validator branch
        task = ChatTask(quantity=10, voice_messages_task={"quantity": 3})
        assert task.voice_messages_task is not None


class TestCallTask:
    def test_create(self):
        from model.tasks import CallTask
        task = CallTask(quantity=10, min_duration=5, max_duration=60)
        assert task.quantity == 10
