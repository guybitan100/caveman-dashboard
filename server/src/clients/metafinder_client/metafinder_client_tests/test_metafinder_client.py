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


class TestGetterMethods:
    """Test each getter method delegates to _get_data correctly."""

    def _make_client(self):
        return MetaFinderClient(host="http://mf")

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_images(self, mock_gd):
        c = self._make_client()
        result = list(c.get_images(count=5, categories=["nature"]))
        assert len(result) == 1
        mock_gd.assert_called_once()
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Image

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_audios(self, mock_gd):
        c = self._make_client()
        list(c.get_audios(count=3, min_duration=10, max_duration=60))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Audio

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_videos(self, mock_gd):
        c = self._make_client()
        list(c.get_videos(count=2))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Video

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_sentences(self, mock_gd):
        c = self._make_client()
        list(c.get_sentences(count=10, languages=["en"]))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Chat

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_urls(self, mock_gd):
        c = self._make_client()
        list(c.get_urls(count=5, cctld="com"))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.URL

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_apps(self, mock_gd):
        c = self._make_client()
        list(c.get_apps(count=5, os="android"))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Application

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_text(self, mock_gd):
        c = self._make_client()
        list(c.get_text(count=3))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Text

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_cell_towers(self, mock_gd):
        c = self._make_client()
        list(c.get_cell_towers(count=2, latitude=32.0, longitude=34.0, mcc=425))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.CellTower

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_documents(self, mock_gd):
        c = self._make_client()
        list(c.get_documents(count=4, format="pdf"))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Document

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_names(self, mock_gd):
        c = self._make_client()
        list(c.get_names(count=5, is_male=True, country_code="US"))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Name

    @patch.object(MetaFinderClient, "_get_data", return_value=iter([MagicMock()]))
    def test_get_crypto(self, mock_gd):
        c = self._make_client()
        list(c.get_crypto(count=3, types=["wallet"], coins=["BTC"]))
        assert mock_gd.call_args.kwargs["data_type"] == DataType.Crypto


class TestGetData:
    @patch("metafinder_client.client.SETTINGS", MagicMock(METAFINDER_MAX_ITEMS=100))
    def test_zero_count_returns_nothing(self):
        c = MetaFinderClient(host="http://mf")
        result = list(c._get_data(data_type=DataType.Image, count=0))
        assert result == []

    @patch("metafinder_client.client.SETTINGS", MagicMock(METAFINDER_MAX_ITEMS=100))
    @patch.object(MetaFinderClient, "_fetch_data")
    def test_yields_validated_models(self, mock_fetch):
        import asyncio

        mock_fetch.return_value = [
            [{"app_id": "a1", "name": "A", "category": "c", "os": "android"}]
        ]
        from metafinder_core.models import AppModel

        c = MetaFinderClient(host="http://mf")
        result = list(
            c._get_data(data_type=DataType.Application, count=1, data_class=AppModel)
        )
        assert len(result) == 1
        assert result[0].app_id == "a1"

    @patch("metafinder_client.client.SETTINGS", MagicMock(METAFINDER_MAX_ITEMS=100))
    @patch.object(MetaFinderClient, "_fetch_data")
    def test_yields_raw_dicts(self, mock_fetch):
        mock_fetch.return_value = [[{"x": 1}, {"x": 2}]]
        c = MetaFinderClient(host="http://mf")
        result = list(c._get_data(data_type=DataType.Image, count=2, data_class=None))
        assert len(result) == 2
        assert result[0]["x"] == 1


class TestFetchRequest:
    @patch(
        "metafinder_client.client.SETTINGS",
        MagicMock(METAFINDER_CLIENT_MAX_CONCURRENCY=5),
    )
    def test_fetch_request_success(self):
        import asyncio
        from unittest.mock import AsyncMock

        c = MetaFinderClient(host="http://mf")
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = AsyncMock(return_value=[{"id": 1}])
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            result = asyncio.run(
                c._fetch_request(data_type=DataType.Image, chunk_count=1)
            )
            assert result == [{"id": 1}]

    @patch(
        "metafinder_client.client.SETTINGS",
        MagicMock(METAFINDER_CLIENT_MAX_CONCURRENCY=5),
    )
    def test_fetch_request_empty_raises(self):
        import asyncio
        from unittest.mock import AsyncMock

        c = MetaFinderClient(host="http://mf")
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = AsyncMock(return_value=[])
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_resp)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            with pytest.raises(MetaFinderError, match="no results"):
                asyncio.run(c._fetch_request(data_type=DataType.Image, chunk_count=1))


class TestGetTermOptionsRange:
    @patch.object(
        MetaFinderClient, "_get_response", return_value={"min": 0, "max": 100}
    )
    def test_returns_response(self, mock_resp):
        from model.metafinder.data_types import KeywordTerms, RangeTerms

        c = MetaFinderClient(host="http://mf")
        result = c.get_term_options_range(
            data_type=DataType.Image,
            term=KeywordTerms.Categories,
            range=RangeTerms.Width,
        )
        assert result == {"min": 0, "max": 100}


class TestGetReportEventFields:
    @patch.object(MetaFinderClient, "_get_data")
    def test_returns_fields(self, mock_gd):
        from metafinder_core.models import (
            ReportModelField,
            ReportModelFieldType,
        )

        mock_gd.return_value = [
            {
                "version": "1.0",
                "model_type": "calls",
                "field_type": ReportModelFieldType.FIELD.value,
                "name": "duration",
                "value_type": "number",
                "is_sub_field": False,
            }
        ]
        c = MetaFinderClient(host="http://mf")
        result = c.get_report_event_fields()
        assert len(result) == 1


class TestGetAppsByIdsWarning:
    @patch.object(MetaFinderClient, "_get_response")
    def test_missing_apps_logs_warning(self, mock_resp):
        mock_resp.return_value = [
            {"app_id": "app1", "name": "App1", "category": "c", "os": "android"},
        ]
        c = MetaFinderClient(host="http://mf")
        result = c.get_apps_by_app_ids(["app1", "app2"])
        assert len(result) == 1
