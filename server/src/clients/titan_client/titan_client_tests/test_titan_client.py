from unittest.mock import patch, MagicMock, mock_open
import pytest

from titan_client.client import (
    TitanClient,
    TitanClientError,
    _handle_titan_client_errors,
)
from model.status import JobStatus
from requests import HTTPError, ConnectionError


class TestTitanClientError:
    def test_is_exception(self):
        err = TitanClientError("test error")
        assert isinstance(err, Exception)
        assert str(err) == "test error"


class TestHandleTitanClientErrors:
    def test_passes_through_on_success(self):
        @_handle_titan_client_errors
        def good_func():
            return "ok"

        assert good_func() == "ok"

    def test_reraises_titan_client_error(self):
        @_handle_titan_client_errors
        def bad_func():
            raise TitanClientError("custom err")

        with pytest.raises(TitanClientError, match="custom err"):
            bad_func()

    def test_wraps_http_error(self):
        @_handle_titan_client_errors
        def http_func():
            raise HTTPError("404")

        with pytest.raises(TitanClientError, match="connection problem"):
            http_func()

    def test_wraps_generic_error(self):
        @_handle_titan_client_errors
        def generic_func():
            raise ValueError("unexpected")

        with pytest.raises(TitanClientError, match="Error in Titan client"):
            generic_func()


class TestTitanClientInit:
    @patch("titan_client.client.requests.get")
    def test_init_with_http(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200)
        client = TitanClient(host="http://localhost:5050")
        assert client._url == "http://localhost:5050/UFDR"

    @patch("titan_client.client.requests.get")
    def test_init_prepends_http(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200)
        client = TitanClient(host="myhost.local")
        assert client._url == "http://myhost.local/UFDR"

    @patch("titan_client.client.requests.get", side_effect=ConnectionError())
    def test_init_connection_error(self, mock_get):
        with pytest.raises(TitanClientError, match="Cannot connect"):
            TitanClient(host="http://unreachable:9999")


class TestTitanClientMethods:
    @patch("titan_client.client.requests.get")
    def _make_client(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200)
        return TitanClient(host="http://localhost:5050")

    @patch("titan_client.client.requests.post")
    @patch("titan_client.client.requests.get")
    def test_create_job(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200)
        mock_response = MagicMock()
        mock_response.json.return_value = {"job_id": "j-123"}
        mock_post.return_value = mock_response
        client = TitanClient(host="http://localhost:5050")
        job = MagicMock()
        job.json.return_value = "{}"
        result = client.create_job(job)
        assert result == "j-123"

    @patch("titan_client.client.requests.get")
    def test_get_job_status(self, mock_get):
        mock_get.side_effect = [
            MagicMock(status_code=200),  # init
            MagicMock(json=lambda: "Done", raise_for_status=lambda: None),
        ]
        client = TitanClient(host="http://localhost:5050")
        status = client.get_job_status("j-123")
        assert status == JobStatus.Done

    @patch("titan_client.client.requests.post")
    @patch("titan_client.client.requests.get")
    def test_cancel_job(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200)
        mock_post.return_value = MagicMock(raise_for_status=lambda: None)
        client = TitanClient(host="http://localhost:5050")
        client.cancel_job("j-123")
        mock_post.assert_called_once()

    @patch("titan_client.client.requests.delete")
    @patch("titan_client.client.requests.get")
    def test_delete_job(self, mock_get, mock_delete):
        mock_get.return_value = MagicMock(status_code=200)
        mock_delete.return_value = MagicMock(raise_for_status=lambda: None)
        client = TitanClient(host="http://localhost:5050")
        client.delete_job("j-123")
        mock_delete.assert_called_once()

    @patch("titan_client.client.shutil.copyfileobj")
    @patch("titan_client.client.requests.get")
    def test_download_ufdr(self, mock_get, mock_copy, tmp_path):
        init_resp = MagicMock(status_code=200)
        status_resp = MagicMock(json=lambda: "Done", raise_for_status=lambda: None)
        link_resp = MagicMock(
            json=lambda: "http://s3.example.com/bucket/file.ufdr",
            raise_for_status=lambda: None,
        )
        download_resp = MagicMock()
        download_resp.__enter__ = MagicMock(return_value=download_resp)
        download_resp.__exit__ = MagicMock(return_value=False)
        download_resp.raw = b"data"

        mock_get.side_effect = [init_resp, status_resp, link_resp, download_resp]
        client = TitanClient(host="http://localhost:5050")
        client.download_ufdr("j-123", tmp_path)

    @patch("titan_client.client.requests.get")
    def test_download_ufdr_not_a_dir(self, mock_get, tmp_path):
        mock_get.return_value = MagicMock(status_code=200)
        client = TitanClient(host="http://localhost:5050")
        fake_file = tmp_path / "file.txt"
        fake_file.touch()
        with pytest.raises(TitanClientError, match="not a directory"):
            client.download_ufdr("j-123", fake_file)

    @patch("titan_client.client.requests.get")
    def test_download_ufdr_not_done(self, mock_get):
        init_resp = MagicMock(status_code=200)
        status_resp = MagicMock(
            json=lambda: "Generating", raise_for_status=lambda: None
        )
        mock_get.side_effect = [init_resp, status_resp]
        client = TitanClient(host="http://localhost:5050")
        import tempfile, os

        with tempfile.TemporaryDirectory() as d:
            with pytest.raises(TitanClientError, match="not done"):
                client.download_ufdr("j-123", d)
