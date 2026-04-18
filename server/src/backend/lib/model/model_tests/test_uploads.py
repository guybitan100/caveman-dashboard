import pytest
from datetime import datetime

from model.uploads import UploadedEntityParams, UploadedMessage


class TestUploadedEntityParams:
    def test_valid(self):
        e = UploadedEntityParams(
            first_name="John",
            phones=["123"],
        )
        assert e.first_name == "John"

    def test_no_name_raises(self):
        with pytest.raises(ValueError, match="first_name or last_name"):
            UploadedEntityParams(phones=["123"])


class TestUploadedMessage:
    def test_create(self):
        m = UploadedMessage(
            sender_id="John Doe",
            text="hello",
            time=datetime(2024, 1, 1),
        )
        assert m.sender_id == "John Doe"
