import pytest

from model.common import CreateDraftJobRequest


class TestCreateDraftJobRequest:
    def test_valid_email(self):
        req = CreateDraftJobRequest(user="test@cellebrite.com", name="Job1")
        assert req.user == "test@cellebrite.com"

    def test_invalid_email(self):
        with pytest.raises(ValueError, match="Invalid email"):
            CreateDraftJobRequest(user="not-an-email", name="Job1")

    def test_no_name(self):
        req = CreateDraftJobRequest(user="test@cellebrite.com")
        assert req.name is None
