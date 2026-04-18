from datetime import date

import networkx as nx

from model.device_models import DeviceModel
from model.job import GenerationJob, DeviceContext, CustomEvent
from model.status import JobStatus
from model.tasks import GenerationTask
from model.types import Entity, DeviceInfoEntry, OwnerEntity
from model.utils import str_uuid


def create_test_generation_job(
        job_id: str | None = None,
        name: str | None = None,
        status: JobStatus = JobStatus.Draft,
        tasks: list[GenerationTask] | None = None,
        context: DeviceContext | None = None,
        device_info: list[DeviceInfoEntry] | None = None,
        custom_events: list[CustomEvent] | None = None,
        stories: nx.DiGraph | None = None,
        owner_entity: Entity | None = None,
        entities: list[Entity] | None = None
) -> GenerationJob:
    tasks = tasks or []
    for task in tasks:
        _initialize_task_ids(task=task)
    context = context or DeviceContext(
        device=DeviceModel(manufacturer='TestManufacturer', name='TestModel', os='android'),
        start_date=date.today().replace(year=date.today().year-1),
        end_date=date.today()
    )
    owner_entity = owner_entity or OwnerEntity(
		first_name='Test', last_name='User', phone='+1234567890', email='test.user@cellebrite.com', is_male=True)
    return GenerationJob(
        job_id=job_id or str_uuid(),
        name=name or str_uuid(),
        status=status,
        tasks=tasks,
        context=context,
        device_info=device_info or [],
        custom_events=custom_events or [],
        stories=stories or nx.DiGraph(),
        owner_entity=owner_entity,
        entities=entities or []
    )


def _initialize_task_ids(
        task: GenerationTask,
        root_task_id: str | None = None
) -> None:
    # Set IDs if not already set
    if not task.task_id:
        task.task_id = str_uuid()
    if root_task_id and not task.parent_task_id:    # root tasks do not have parent_task_id
        task.parent_task_id = task.task_id
    if root_task_id and not task.root_task_id:
        task.root_task_id = root_task_id
    for sub_task in task.get_sub_tasks():
        _initialize_task_ids(
            task=sub_task,
            root_task_id=root_task_id or task.task_id   # if no specified root, this task is the root
        )
