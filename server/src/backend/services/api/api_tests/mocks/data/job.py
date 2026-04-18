from model.device_models import DeviceModel
from model.job import DeviceContext
from model.tasks import LocationTask
from model_tests.test_utils import create_test_generation_job


MOCK_JOB_NAME = 'mock-job'
MOCK_JOB_ID = 'mock-job-id'
MOCK_NEW_JOB = create_test_generation_job(
    job_id=MOCK_JOB_ID,
    name=MOCK_JOB_NAME
)
MOCK_GENERATION_JOB = create_test_generation_job(
    context=DeviceContext(
        device=DeviceModel(manufacturer='HTC', name='ChaCha', os="android"),
        start_date="2021-06-23",
        end_date="2022-06-23"
    ),
    tasks=[LocationTask(quantity=1)]
)
