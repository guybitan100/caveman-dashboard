from model.device_models import DeviceModel
from model.job import DeviceContext
from model.tasks import ChatTask, NoteTask
from model_tests.test_utils import create_test_generation_job

MOCK_GENERATION_JOB = create_test_generation_job(
    context=DeviceContext(
        device=DeviceModel(manufacturer='HTC', name="ChaCha", os="android"),
        start_date="2021-06-23",
        end_date="2022-06-23"
    ),
    tasks=[ChatTask(quantity=1)]
)

MOCK_GENERATION_JOB_NOTES = create_test_generation_job(
    context=DeviceContext(
        device=DeviceModel(manufacturer='HTC', name="ChaCha", os="android"),
        start_date="2021-06-23",
        end_date="2022-06-23"
    ),
    tasks=[NoteTask(quantity=12)],
    custom_events=[],
)

MOCK_GENERATION_JOB_WITH_APPS = create_test_generation_job(
    context=DeviceContext(
        device=DeviceModel(manufacturer='HTC', name="ChaCha", os="android"),
        start_date="2021-06-23",
        end_date="2022-06-23"
    ),
    tasks=[
        ChatTask(
            quantity=1,
            app_id="com.bluefishapp.blureffect"
        )
    ]
)

MOCK_GENERATION_JOB_WITHOUT_TASKS = create_test_generation_job(
    context=DeviceContext(
        device=DeviceModel(manufacturer='HTC', name="ChaCha", os="android"),
        start_date="2021-06-23",
        end_date="2022-06-23"
    )
)
