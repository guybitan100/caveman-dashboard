from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient


class TestAppSetup:
    @patch("api.app.SETTINGS", MagicMock(API_PORT=5050))
    def test_app_has_routes(self):
        from api.app import app

        assert app is not None
        routes = [r.path for r in app.routes]
        assert "/" in routes

    @patch("api.app.SETTINGS", MagicMock(API_PORT=5050))
    def test_index_endpoint(self):
        from api.app import app

        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200
        assert "Titan" in response.text


class TestHandler:
    @patch("api.handler.create_tables")
    def test_startup_handler(self, mock_create):
        from api.handler import startup_handler

        startup_handler(None, None)
        mock_create.assert_called_once()

    @patch("api.handler.delete_tables")
    def test_shutdown_handler(self, mock_delete):
        from api.handler import shutdown_handler

        shutdown_handler(None, None)
        mock_delete.assert_called_once()
