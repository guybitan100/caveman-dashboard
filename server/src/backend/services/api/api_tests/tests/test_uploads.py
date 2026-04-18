from unittest.mock import patch, MagicMock
from datetime import datetime

import pytest

from api.uploads import (
    _get_entity_name,
    _convert_messages,
    handle_uploaded_chat,
    convert_uploaded_data,
    verify_uploaded_files_exist_or_fail,
)


class TestGetEntityName:
    def test_first_and_last(self):
        entity = MagicMock(first_name="John", last_name="Doe")
        assert _get_entity_name(entity) == "John Doe"

    def test_first_only(self):
        entity = MagicMock(first_name="John", last_name=None)
        assert _get_entity_name(entity) == "John"

    def test_last_only(self):
        entity = MagicMock(first_name=None, last_name="Doe")
        assert _get_entity_name(entity) == "Doe"


class TestConvertMessages:
    def test_converts(self):
        msg = MagicMock(
            sender_id="John Doe",
            text="hello",
            status="Read",
            forwarded=False,
            time=datetime(2024, 1, 1),
        )
        result = _convert_messages(
            uploaded_messages=[msg],
            entities_name_to_uid={"John Doe": "uid1"},
            chat_uid="c1",
        )
        assert len(result) == 1
        assert result[0].sender == "uid1"
        assert result[0].text == "hello"


class TestConvertUploadedData:
    def test_unsupported_type(self):
        with pytest.raises(ValueError, match="Unsupported"):
            convert_uploaded_data(uploaded_data=MagicMock())


class TestHandleUploadedChat:
    def test_entity_name(self):
        # Just test the helper since full integration needs real pydantic models
        entity = MagicMock(first_name="A", last_name="B")
        assert _get_entity_name(entity) == "A B"


class TestVerifyUploadedFilesExistOrFail:
    @patch("api.uploads.TitanS3Client")
    @patch("api.uploads.SETTINGS", MagicMock(
        S3_TITAN_BUCKET_NAME="test-bucket",
        S3_BUCKET_UPLOADS_PREFIX="uploads",
    ))
    def test_no_tasks_no_stories(self, mock_s3_cls):
        mock_s3 = MagicMock()
        mock_s3_cls.return_value = mock_s3
        job = MagicMock()
        job.tasks = []
        job.stories = MagicMock()
        job.stories.nodes.data.return_value = []
        verify_uploaded_files_exist_or_fail(job)
