"""
Tests for the tasks module, specifically testing the task type discriminator.
"""

import pytest

from model.tasks import _discriminate_task_type
from model.types import EventType, FILE_EVENT_TYPES


class TestDiscriminateTaskType:
    """Tests for the _discriminate_task_type discriminator function."""

    def test_file_event_type_returns_file(self):
        """Tests that FILE_EVENT_TYPES are correctly discriminated as 'file'."""
        for event_type in FILE_EVENT_TYPES:
            data = {'event_type': event_type.value}
            result = _discriminate_task_type(data)
            assert result == 'file', f"Expected 'file' for {event_type.value}, got '{result}'"

    def test_file_event_type_as_enum_returns_file(self):
        """Tests that FILE_EVENT_TYPES as enum values are correctly discriminated as 'file'."""
        for event_type in FILE_EVENT_TYPES:
            data = {'event_type': event_type}
            result = _discriminate_task_type(data)
            assert result == 'file', f"Expected 'file' for {event_type}, got '{result}'"

    def test_non_file_event_type_returns_event(self):
        """Tests that non-file event types are correctly discriminated as 'event'."""
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
        """Tests that non-file event types as enum values are correctly discriminated as 'event'."""
        data = {'event_type': EventType.CONTACT}
        result = _discriminate_task_type(data)
        assert result == 'event'

    def test_upload_flag_true_returns_upload(self):
        """Tests that is_upload=True returns 'upload'."""
        data = {'is_upload': True}
        result = _discriminate_task_type(data)
        assert result == 'upload'

    def test_upload_flag_false_returns_file(self):
        """Tests that is_upload=False returns 'file'."""
        data = {'is_upload': False}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_invalid_data_raises_error(self):
        """Tests that invalid data raises ValueError."""
        with pytest.raises(ValueError, match='Cannot discriminate task type'):
            _discriminate_task_type({})

    def test_all_file_event_types_covered(self):
        """Verifies all FILE_EVENT_TYPES are correctly identified."""
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
        """Tests that 'images' string event_type returns 'file'."""
        data = {'event_type': 'images'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_videos_returns_file(self):
        """Tests that 'videos' string event_type returns 'file'."""
        data = {'event_type': 'videos'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_audios_returns_file(self):
        """Tests that 'audios' string event_type returns 'file'."""
        data = {'event_type': 'audios'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_documents_returns_file(self):
        """Tests that 'documents' string event_type returns 'file'."""
        data = {'event_type': 'documents'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_archives_returns_file(self):
        """Tests that 'archives' string event_type returns 'file'."""
        data = {'event_type': 'archives'}
        result = _discriminate_task_type(data)
        assert result == 'file'

    def test_string_event_type_contacts_returns_event(self):
        """Tests that 'contacts' string event_type returns 'event'."""
        data = {'event_type': 'contacts'}
        result = _discriminate_task_type(data)
        assert result == 'event'

    def test_string_event_type_chat_messages_returns_event(self):
        """Tests that 'chat messages' string event_type returns 'event'."""
        data = {'event_type': 'chat messages'}
        result = _discriminate_task_type(data)
        assert result == 'event'
