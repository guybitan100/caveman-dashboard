import os
import uuid

import pytest

from model.tasks import ImageTask, VideoTask
from model_tests.test_utils import create_test_generation_job

BASE_URL = os.environ["BASE_URL"] + "/UFDR"

@pytest.fixture
def api_url() -> str:
    return BASE_URL


@pytest.fixture
def job_id() -> str:
    uniq_id = uuid.uuid4()
    job_id = f"integration-test-job-{uniq_id}"
    return job_id[:36]


@pytest.fixture
def new_job(job_id: str) -> dict:
    task = ImageTask(quantity=10)
    new_job = create_test_generation_job(
        job_id=job_id,
        name="integration-test-job",
        tasks=[task]
    )
    new_job_dict = new_job.model_dump()
    print(new_job_dict)
    return new_job_dict


@pytest.fixture
def new_long_job(job_id: str) -> dict:
    image_task = ImageTask(quantity=10)
    video_task = VideoTask(quantity=20)
    new_job = create_test_generation_job(
        job_id=job_id,
        name="integration-test-job",
        tasks=[image_task, video_task],
    )
    new_job_dict = new_job.model_dump()
    print(new_job_dict)
    return new_job_dict
