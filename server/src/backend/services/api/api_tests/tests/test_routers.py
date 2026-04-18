from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from core.routes import (
    API_PREFIX, DOWNLOAD, JOB_ID, UPLOAD_FILE, FILE_NAME, FILE_MD5,
    API_JOB_ROUTER_PREFIX, API_JOBS_ROUTER_PREFIX, PREFIX,
    TASK_PROGRESS, TASK_ID, DEVICE_MODELS as DEVICE_MODELS_ROUTE,
)


@pytest.fixture
def client():
    from api.app import app
    yield TestClient(app)


class TestGetDeviceModels:
    def test_get_device_models(self, client):
        response = client.get(f"{API_PREFIX}{DEVICE_MODELS_ROUTE}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestGenerateEntity:
    @patch("api.routers.main.generate_entities")
    def test_generate_entity(self, mock_gen, client):
        mock_gen.return_value = [{"uid": "e1"}]
        response = client.post(f"{API_PREFIX}/generate/entity", json={"count": 1})
        assert response.status_code == 200


class TestGetAllJobsMatchingPrefix:
    @patch("api.routers.main.operations.get_all_jobs_matching_prefix")
    def test_returns_list(self, mock_op, client):
        mock_op.return_value = []
        response = client.get(f"{API_PREFIX}{API_JOBS_ROUTER_PREFIX}{PREFIX}", params={"prefix": "test"})
        assert response.status_code == 200



class TestDownload:
    @patch("api.routers.main.operations.download_ufdr")
    def test_download(self, mock_op, client):
        mock_op.return_value = {"url": "https://example.com/file"}
        response = client.get(f"{API_PREFIX}{DOWNLOAD}/j1")
        assert response.status_code == 200


class TestUploadFile:
    @patch("api.routers.main.operations.get_upload_presigned_url")
    def test_upload_file(self, mock_op, client):
        mock_op.return_value = {"url": "https://s3.example.com", "fields": {}}
        response = client.post(f"{API_PREFIX}{UPLOAD_FILE}/test.zip")
        assert response.status_code == 200


class TestDoesUploadedFileExist:
    @patch("api.routers.main.operations.does_uploaded_file_exists")
    def test_check(self, mock_op, client):
        mock_op.return_value = True
        response = client.get(f"{API_PREFIX}{UPLOAD_FILE}/abc123")
        assert response.status_code == 200



class TestGetAllJobs:
    @patch("api.routers.main.operations.get_all_jobs")
    def test_returns_jobs(self, mock_op, client):
        mock_op.return_value = ([], 0)
        response = client.get(f"{API_PREFIX}{API_JOBS_ROUTER_PREFIX}", params={"page": 1})
        assert response.status_code == 200
