from typing import Iterator

import pytest
from pytest_mock import MockerFixture

from generation.simulation.social import SocialContext
from generation_tests.mocks.data.social import ENTITIES, OWNER_ENTITY, WEIGHTS
from model.device_models import DeviceModel
from model.job import DeviceContext, GenerationJob
from model.tasks import ChatTask, GenerationTask
from model.types import Location
from model_tests.test_utils import create_test_generation_job


@pytest.fixture
def job() -> GenerationJob:
    job_id = "60c13a69-0e04-49ce-9a3b-16c49667a1a3"
    tasks = [ChatTask(quantity=1)]
    context = DeviceContext(
        device=DeviceModel(manufacturer='Google', name="Pixel 5", os="android"),
        start_date="2021-02-28",
        end_date="2022-02-28"
    )
    job = create_test_generation_job(job_id=job_id, tasks=tasks, context=context)
    return job


@pytest.fixture(scope="class")
def c_generation_job(job, request):
    request.cls.job = job


@pytest.fixture
def social_context(mocker: MockerFixture) -> "SocialContext":

    def get_task_locations_hub_side_effect(task: GenerationTask, shuffle: bool = False) -> Iterator[Location | None]:
        yield from [None] * task.quantity

    def get_task_location_ids_hub_side_effect(task: GenerationTask) -> Iterator[str | None]:
        yield from [None] * task.quantity

    get_locations_hub_mock = mocker.patch('generation.simulation.hub.TaskGenerationHub.get_task_locations')
    get_locations_hub_mock.side_effect = get_task_locations_hub_side_effect
    get_location_ids_hub_mock = mocker.patch('generation.simulation.hub.TaskGenerationHub.get_task_location_ids')
    get_location_ids_hub_mock.side_effect = get_task_location_ids_hub_side_effect

    return SocialContext(
        entities=ENTITIES,
        owner_entity=OWNER_ENTITY,
        weights=WEIGHTS,
        location_allocations={}
    )


@pytest.fixture
def job_hub(social_context):
    job_id = "60c13a69-0e04-49ce-9a3b-16c49667a1a3"

    context = DeviceContext(
        device=DeviceModel(manufacturer='Google', name="Pixel 5", os="android"),
        start_date="2021-02-28",
        end_date="2022-02-28"
    )
    job = create_test_generation_job(job_id=job_id, context=context)

    from generation.simulation.hub import TaskGenerationHub
    return TaskGenerationHub(job=job, context=social_context)


@pytest.fixture(scope="class")
def c_hub(request, class_mocker: MockerFixture):

    def get_task_locations_hub_side_effect(task: GenerationTask, shuffle: bool = False) -> Iterator[Location | None]:
        yield from [None] * task.quantity

    def get_task_location_ids_hub_side_effect(task: GenerationTask) -> Iterator[str | None]:
        yield from [None] * task.quantity

    get_locations_hub_mock = class_mocker.patch('generation.simulation.hub.TaskGenerationHub.get_task_locations')
    get_locations_hub_mock.side_effect = get_task_locations_hub_side_effect
    get_location_ids_hub_mock = class_mocker.patch('generation.simulation.hub.TaskGenerationHub.get_task_location_ids')
    get_location_ids_hub_mock.side_effect = get_task_location_ids_hub_side_effect
    context = SocialContext(
        entities=ENTITIES,
        owner_entity=OWNER_ENTITY,
        weights=WEIGHTS,
        location_allocations={}
    )

    job_id = "60c13a69-0e04-49ce-9a3b-16c49667a1a3"
    device_context = DeviceContext(
        device=DeviceModel(manufacturer='Google', name="Pixel 5", os="android"),
        start_date="2021-02-28",
        end_date="2022-02-28"
    )
    job = create_test_generation_job(job_id=job_id, context=device_context)
    from generation.simulation.hub import TaskGenerationHub
    request.cls.hub = TaskGenerationHub(job=job, context=context)
