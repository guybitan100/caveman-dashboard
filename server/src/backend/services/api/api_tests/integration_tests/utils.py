import logging
import time

import requests

logger = logging.getLogger(__name__)
JOB_TIMEOUT = 60 * 5

def create_job(api_url: str, job_payload: dict) -> dict:
    url = f"{api_url}/job"
    response = requests.post(url, json=job_payload)
    assert response.status_code == 200
    logger.info(f"Created job with response: {response.json()}")
    return response.json()


def wait_for_job_status(api_url: str, job_id: str, target_status: str, timeout: int = JOB_TIMEOUT) -> None:
    time.sleep(1)
    start_time = time.time()
    response = requests.get(f"{api_url}/job/{job_id}")
    assert response.status_code == 200
    response_json = response.json()
    status = response_json["status"]
    while status != target_status:
        if time.time() - start_time > timeout:
            raise TimeoutError(f"Job did not reach {target_status} status in time. Current status: {status}")
        time.sleep(5)
        response = requests.get(f"{api_url}/job/{job_id}")
        assert response.status_code == 200
        response_json = response.json()
        status = response_json["status"]
    assert status == target_status
