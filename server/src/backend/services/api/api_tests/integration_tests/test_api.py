import requests

from api_tests.integration_tests.utils import JOB_TIMEOUT, create_job, wait_for_job_status


def test_post_new_job(api_url: str, new_job: dict):
    response_json = create_job(api_url, new_job)
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, new_job["job_id"], "Done")


def test_get_job_status(api_url: str, new_job: dict) -> None:
    response_json = create_job(api_url, new_job)
    _job_id = new_job["job_id"]
    assert response_json["status"] == "success"
    response = requests.get(f"{api_url}/job/{_job_id}")
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["status"] is not None


def test_post_delete_job(api_url: str, new_job: dict) -> None:
    response_json = create_job(api_url, new_job)
    _job_id = new_job["job_id"]
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, _job_id, "Done")
    response = requests.delete(f"{api_url}/job/{_job_id}")
    assert response.status_code == 200


def test_post_cancel_job(api_url: str, new_long_job: dict) -> None:
    response_json = create_job(api_url, new_long_job)
    _job_id = new_long_job["job_id"]
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, _job_id, "Generating")
    response = requests.post(f"{api_url}/job/cancel/{_job_id}")
    assert response.status_code == 200
    wait_for_job_status(api_url, _job_id, "Cancelled")


def test_post_cancel_delete_job(api_url: str, new_long_job: dict) -> None:
    response_json = create_job(api_url, new_long_job)
    _job_id = new_long_job["job_id"]
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, _job_id, "Generating")
    response = requests.delete(f"{api_url}/job/{_job_id}")
    assert response.status_code == 200


def test_post_rerun_job(api_url: str, new_job: dict) -> None:
    response_json = create_job(api_url, new_job)
    _job_id = new_job["job_id"]
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, _job_id, "Done")
    response = requests.post(f"{api_url}/job/{_job_id}")
    assert response.status_code == 200
    wait_for_job_status(api_url, _job_id, "Done")


def test_post_rerun_canceled_job(api_url: str, new_long_job: dict) -> None:
    response_json = create_job(api_url, new_long_job)
    _job_id = new_long_job["job_id"]
    assert response_json["status"] == "success"
    wait_for_job_status(api_url, _job_id, "Generating")
    response = requests.post(f"{api_url}/job/cancel/{_job_id}")
    assert response.status_code == 200
    wait_for_job_status(api_url, _job_id, "Cancelled")
    response = requests.post(f"{api_url}/job/{_job_id}")
    assert response.status_code == 200
    wait_for_job_status(api_url, _job_id, "Done", timeout=JOB_TIMEOUT * 2)
