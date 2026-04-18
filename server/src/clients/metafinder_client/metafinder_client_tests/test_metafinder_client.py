from unittest.mock import patch, MagicMock
import pytest

from metafinder_client.client import (
    MetaFinderClient,
    MetaFinderError,
    _handle_metafinder_errors,
    _parse_query,
    _get_array_query,
    Container,
)
from model.metafinder.data_types import DataType
from model.metafinder.queries import QueryOperator, ArrayQuery
from pydantic import BaseModel
from requests import HTTPError


class TestMetaFinderError:
    def test_is_exception(self):
        err = MetaFinderError("test")
        assert isinstance(err, Exception)
        assert str(err) == "test"


class TestHandleMetafinderErrors:
    def test_success(self):
        @_handle_metafinder_errors
        def ok():
            return "result"

        assert ok() == "result"

    def test_reraises_metafinder_error(self):
        @_handle_metafinder_errors
        def bad():
            raise MetaFinderError("custom")

        with pytest.raises(MetaFinderError, match="custom"):
            bad()

    def test_wraps_http_error(self):
        @_handle_metafinder_errors
        def http_err():
            raise HTTPError("404")

        with pytest.raises(MetaFinderError, match="connection problem"):
            http_err()

    def test_wraps_generic(self):
        @_handle_metafinder_errors
        def gen_err():
            raise ValueError("unexpected")

        with pytest.raises(MetaFinderError, match="Error in handling MetaFinder"):
            gen_err()


class TestParseQuery:
    def test_string(self):
        assert _parse_query("hello") == "hello"

    def test_int(self):
        assert _parse_query(42) == 42

    def test_pydantic_model(self):
        class M(BaseModel):
            x: int = 1

        result = _parse_query(M())
        assert isinstance(result, dict)
        assert result["x"] == 1


class TestGetArrayQuery:
    def test_none_when_empty(self):
        assert _get_array_query(None, False) is None
        assert _get_array_query([], False) is None

    def test_or_operator(self):
        result = _get_array_query(["a", "b"], False)
        assert isinstance(result, ArrayQuery)
        assert result.operator == QueryOperator.OR

    def test_and_operator(self):
        result = _get_array_query(["a", "b"], True)
        assert result.operator == QueryOperator.AND


class TestMetaFinderClientInit:
    @patch(
        "metafinder_client.client.SETTINGS",
        MagicMock(METAFINDER_HOST="http://localhost:9200"),
    )
    def test_default_host(self):
        client = MetaFinderClient(host="http://localhost:9200")
        assert client._url == "http://localhost:9200"

    def test_custom_host(self):
        client = MetaFinderClient(host="http://custom:1234")
        assert client._url == "http://custom:1234"


class TestMetaFinderClientGetCount:
    @patch.object(MetaFinderClient, "_get_response", return_value=42)
    def test_get_count(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_count(data_type=DataType.Image)
        assert result == 42
        mock_resp.assert_called_once()

    @patch.object(MetaFinderClient, "_get_response", return_value=10)
    def test_get_count_with_categories(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_count(
            data_type=DataType.Image, categories=["nature"], is_categories_and_op=False
        )
        assert result == 10


class TestMetaFinderClientFieldCounts:
    @patch.object(
        MetaFinderClient, "_get_response", return_value={"en": {"count": 100}}
    )
    def test_get_chat_message_languages(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_chat_message_languages()
        assert "en" in result

    @patch.object(
        MetaFinderClient, "_get_response", return_value={"nature": {"count": 50}}
    )
    def test_get_categories(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_categories(data_type=DataType.Image)
        assert "nature" in result

    @patch.object(
        MetaFinderClient, "_get_response", return_value={"jpg": {"count": 30}}
    )
    def test_get_formats(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_formats(data_type=DataType.Image)
        assert "jpg" in result

    @patch.object(
        MetaFinderClient, "_get_response", return_value={"opt1": {"count": 5}}
    )
    def test_get_term_options(self, mock_resp):
        from model.metafinder.data_types import KeywordTerms

        client = MetaFinderClient(host="http://mf")
        result = client.get_term_options(
            data_type=DataType.Image, term=KeywordTerms.Categories
        )
        assert "opt1" in result

    @patch.object(MetaFinderClient, "_get_response", return_value=100)
    def test_get_term_average(self, mock_resp):
        from model.metafinder.data_types import RangeTerms

        client = MetaFinderClient(host="http://mf")
        result = client.get_term_average(
            data_type=DataType.Image, term=RangeTerms.Width
        )
        assert result == 100


class TestMetaFinderClientGetAppsByIds:
    @patch.object(MetaFinderClient, "_get_response")
    def test_empty_ids(self, mock_resp):
        client = MetaFinderClient(host="http://mf")
        result = client.get_apps_by_app_ids([])
        assert result == []
        mock_resp.assert_not_called()

    @patch.object(MetaFinderClient, "_get_response")
    def test_with_ids(self, mock_resp):
        mock_resp.return_value = [
            {
                "app_id": "com.example",
                "name": "Example",
                "category": "util",
                "os": "android",
            }
        ]
        client = MetaFinderClient(host="http://mf")
        result = client.get_apps_by_app_ids(["com.example"])
        assert len(result) == 1


class TestMetaFinderClientGetAllApps:
    @patch.object(MetaFinderClient, "_get_response")
    def test_get_all(self, mock_resp):
        mock_resp.return_value = [
            {"app_id": "app1", "name": "App1", "category": "games", "os": "ios"}
        ]
        client = MetaFinderClient(host="http://mf")
        result = client.get_all_apps()
        assert len(result) == 1


class TestMetaFinderClientDownload:
    @patch("metafinder_client.client.SETTINGS", MagicMock(BUCKET_NAME="bucket"))
    def test_download_file(self):
        client = MetaFinderClient(host="http://mf")
        mock_s3 = MagicMock()
        client.download_file(s3_key="key", filepath="/tmp/file", s3_client=mock_s3)
        mock_s3.download_file.assert_called_once_with(
            bucket_name="bucket", s3_key="key", file_name="/tmp/file"
        )
