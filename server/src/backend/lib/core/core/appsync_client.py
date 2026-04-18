import json

import requests

from core.config import SETTINGS


class AppsyncClient:
    
    def __init__(self):
        endpoint_url = SETTINGS.WEBSOCKET_ENDPOINT
        api_key = SETTINGS.WEBSOCKET_API_KEY
        namespace = SETTINGS.WEBSOCKET_NAMESPACE
        if any([not endpoint_url, not api_key, not namespace]):
            raise Exception("AppsyncClient is not configured")
        
        self._endpoint_url = 'https://' + endpoint_url + '/event'
        self._api_key = api_key.get_secret_value()
        self._namespace = namespace
        
    
    def publish_event(self, events: list[dict], channel: str) -> None:
        try:
            headers = {
                "content-type": "application/json",
                "x-api-key": self._api_key
            }
            body = {
                "channel": f"{self._namespace}/{channel}",
                "events": [json.dumps(event) for event in events]
            }
            response = requests.post(self._endpoint_url, headers=headers, data=json.dumps(body))
            response.raise_for_status()
        except requests.RequestException as e:
            raise Exception(f"Failed to publish event: {e}")
    