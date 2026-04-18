from unittest.mock import patch, MagicMock

import pytest

from core.appsync_client import AppsyncClient


class TestAppsyncClient:
    @patch(
        "core.appsync_client.SETTINGS",
        MagicMock(
            WEBSOCKET_ENDPOINT="ws.example.com",
            WEBSOCKET_API_KEY=MagicMock(
                get_secret_value=MagicMock(return_value="api_key_123")
            ),
            WEBSOCKET_NAMESPACE="ns",
        ),
    )
    def test_init(self):
        client = AppsyncClient()
        assert client._endpoint_url == "https://ws.example.com/event"
        assert client._api_key == "api_key_123"
        assert client._namespace == "ns"

    @patch(
        "core.appsync_client.SETTINGS",
        MagicMock(
            WEBSOCKET_ENDPOINT=None,
            WEBSOCKET_API_KEY="key",
            WEBSOCKET_NAMESPACE="ns",
        ),
    )
    def test_init_missing_config(self):
        with pytest.raises(Exception, match="not configured"):
            AppsyncClient()

    @patch(
        "core.appsync_client.SETTINGS",
        MagicMock(
            WEBSOCKET_ENDPOINT="ws.example.com",
            WEBSOCKET_API_KEY=MagicMock(get_secret_value=MagicMock(return_value="key")),
            WEBSOCKET_NAMESPACE="ns",
        ),
    )
    @patch("core.appsync_client.requests.post")
    def test_publish_event(self, mock_post):
        mock_post.return_value = MagicMock(raise_for_status=MagicMock())
        client = AppsyncClient()
        client.publish_event(events=[{"key": "value"}], channel="ch1")
        mock_post.assert_called_once()

    @patch(
        "core.appsync_client.SETTINGS",
        MagicMock(
            WEBSOCKET_ENDPOINT="ws.example.com",
            WEBSOCKET_API_KEY=MagicMock(get_secret_value=MagicMock(return_value="key")),
            WEBSOCKET_NAMESPACE="ns",
        ),
    )
    @patch("core.appsync_client.requests.post")
    def test_publish_event_failure(self, mock_post):
        import requests

        mock_post.side_effect = requests.RequestException("fail")
        client = AppsyncClient()
        with pytest.raises(Exception, match="Failed to publish"):
            client.publish_event(events=[{"k": "v"}], channel="ch")
