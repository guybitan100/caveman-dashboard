import itertools
from typing import Iterator, Iterable

from pynamodb.exceptions import DoesNotExist, PutError
from pynamodb.expressions.update import Action

from model.tasks import GenerationTask
from model.status import GenerationTaskStatus
from model.utils import now
from six_db.jobs.db_job_utils import get_job_model
from six_db.jobs.errors import TaskNotFoundError
from six_db.jobs.models import DBGenerationTaskModel


def insert_task(job_id: str, task: GenerationTask) -> None:
    """Insert a new generation task record(s)"""
    db_job = get_job_model(job_id=job_id)
    db_tasks = list(_flatten_db_tasks_from_root_task(job_id=job_id, task=task))
    db_job.tasks.extend(db_tasks)
    db_job.save()


def insert_tasks(job_id: str, tasks: Iterable[GenerationTask]) -> None:
    """Insert multiple generation tasks"""
    db_job = get_job_model(job_id=job_id)
    db_tasks = list(itertools.chain.from_iterable(
        _flatten_db_tasks_from_root_task(job_id=job_id, task=task)
        for task in tasks
    ))
    db_job.tasks.extend(db_tasks)
    db_job.save()


def update_task(job_id: str, task_id: str, task: GenerationTask) -> None:
    """Update an existing generation task"""
    delete_task(job_id=job_id, task_id=task_id)
    insert_task(job_id=job_id, task=task)


def delete_task(job_id: str, task_id: str) -> None:
    """Delete a generation task and its recursive sub-tasks. Only root tasks (not sub-tasks) can be deleted."""
    deleted_task_ids = {task_id}
    db_job = get_job_model(job_id=job_id)
    with DBGenerationTaskModel.batch_write() as batch:
        db_sub_tasks = DBGenerationTaskModel.job_id_index.query(
            job_id,
            filter_condition=DBGenerationTaskModel.root_task_id == task_id,
            attributes_to_get=[DBGenerationTaskModel.task_id.attr_name]
        )
        for db_sub_task in db_sub_tasks:
            deleted_task_ids.add(db_sub_task.task_id)
            batch.delete(db_sub_task)
        batch.delete(DBGenerationTaskModel(task_id))
    db_job.tasks = [t for t in db_job.tasks if t.task_id not in deleted_task_ids]
    db_job.save()


def update_generation_task_status(task_id: str, status: GenerationTaskStatus):
    actions = [DBGenerationTaskModel.status.set(status)]
    if status is GenerationTaskStatus.Generating:
        actions.append(DBGenerationTaskModel.started_at.set(now()))
    elif status is GenerationTaskStatus.Done:
        actions.append(DBGenerationTaskModel.finished_at.set(now()))
    _update_task_model(task_id=task_id, actions=actions)


def update_generation_task_final_count(task_id: str, count: int):
    _update_task_model(task_id=task_id, actions=[DBGenerationTaskModel.final_count.set(count)])


def get_generation_task(task_id: str) -> DBGenerationTaskModel:
    return _get_task_model(task_id=task_id)


def _get_task_model(task_id: str, attributes: list[str] | None = None) -> DBGenerationTaskModel:
    try:
        return DBGenerationTaskModel.get(task_id, attributes_to_get=attributes)
    except DoesNotExist:
        raise TaskNotFoundError(task_id=task_id)



def _update_task_model(task_id: str, actions: list[Action]) -> None:
    try:
        DBGenerationTaskModel(task_id).update(actions=actions, condition=DBGenerationTaskModel.task_id.exists())
    except PutError as e:
        raise TaskNotFoundError(task_id=task_id) from e


def _flatten_db_tasks_from_root_task(job_id: str, task: GenerationTask) -> Iterator[DBGenerationTaskModel]:
    """Get DBGenerationTaskModel(s) from a GenerationTask and its sub-tasks"""
    root_db_task = DBGenerationTaskModel(
        job_id=job_id,
        task_id=task.task_id,
        event_type=task.event_type,
        requested_count=task.quantity,
        params=task.model_dump(mode='json'),
        quantity=task.quantity
    )
    yield root_db_task
    yield from _get_sub_db_tasks_from_task(
        job_id=job_id,
        task=task,
        root_task_id=task.task_id
    )


def _get_sub_db_tasks_from_task(
        job_id: str,
        task: GenerationTask,
        root_task_id: str
) -> Iterator[DBGenerationTaskModel]:
    """Recursively get DBGenerationTaskModel(s) from a GenerationTask and its sub-tasks"""
    for sub_task in task.get_sub_tasks():
        sub_task.parent_task_id = task.task_id
        sub_task.root_task_id = root_task_id
        sub_db_task = DBGenerationTaskModel(
            job_id=job_id,
            task_id=sub_task.task_id,
            parent_task_id=sub_task.parent_task_id,
            root_task_id=sub_task.root_task_id,
            event_type=sub_task.event_type,
            requested_count=sub_task.quantity,
            params=sub_task.model_dump(mode='json'),
            quantity=sub_task.quantity
        )
        yield sub_db_task
        yield from _get_sub_db_tasks_from_task(
            job_id=job_id,
            task=sub_task,
            root_task_id=root_task_id
        )


def get_task_progress(task_id: str) -> tuple[GenerationTaskStatus, float]:
    db_task = _get_task_model(
        task_id=task_id,
        attributes=[
            DBGenerationTaskModel.status.attr_name,
            DBGenerationTaskModel.requested_count.attr_name,
            DBGenerationTaskModel.final_count.attr_name
        ]
    )
    if db_task.requested_count:
        progress = (db_task.final_count or 0) / db_task.requested_count
    else:   # Original task quantity was 0
        progress = 1.0 if db_task.status is GenerationTaskStatus.Done else 0.0
    return db_task.status, progress
