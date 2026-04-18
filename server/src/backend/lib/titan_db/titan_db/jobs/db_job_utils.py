from pynamodb.exceptions import DoesNotExist, PutError
from pynamodb.expressions.update import Action

from titan_db.jobs.attributes import S3FileAttribute
from titan_db.jobs.errors import JobNotFoundError, TaskNotFoundError, PhaseNotFoundError, EntityNotFoundError
from titan_db.jobs.models import DBGenerationTaskModel, DBJobModel, DBJobPhaseModel
from model.common import JobSummary
from model.job import GenerationJob, DeviceContext, CustomEvent
from model.tasks import GenerationTask, GenerationTaskAdapter
from model.manifest import Manifest
from model.phase import TitanPhase
from model.status import JobStatus, PhaseStatus
from model.types import EventType, Entity, DeviceInfoEntry, OwnerEntity
from model.utils import now, deserialize


def insert_job(
        user: str,
        name: str | None,
		owner_entity: OwnerEntity,
        device_context: DeviceContext,
        device_info: list[DeviceInfoEntry]
) -> str:
    db_job = DBJobModel(
		user=user.lower(),
		name=name,
		owner_entity=owner_entity,
		device_context=device_context,
		device_info=device_info
	)
    db_job.save()
    return db_job.id


def update_job_name(job_id: str, name: str) -> None:
    update_job_model(job_id=job_id, actions=[DBJobModel.name.set(name)])


def get_device_info(job_id: str) -> list[DeviceInfoEntry]:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.device_info.attr_name])
    return db_job.device_info


def update_device_context_and_info(
        job_id: str,
        device_context: DeviceContext,
        device_info: list[DeviceInfoEntry]
) -> None:
    update_job_model(job_id=job_id, actions=[
        DBJobModel.device_context.set(device_context),
        DBJobModel.device_info.set(device_info)
    ])


def update_device_info(job_id: str, device_info: list[DeviceInfoEntry]) -> None:
    update_job_model(job_id=job_id, actions=[DBJobModel.device_info.set(device_info)])


def update_owner_entity(job_id: str, entity: OwnerEntity) -> None:
    update_job_model(job_id=job_id, actions=[DBJobModel.owner_entity.set(entity)])


def insert_entities(job_id: str, entities: list[Entity]) -> None:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.entities.attr_name])
    existing_entities = db_job.entities or []
    updated_entities = existing_entities + entities
    update_job_model(job_id=job_id, actions=[DBJobModel.entities.set(updated_entities)])


def update_entity(job_id: str, entity_id: str, entity: Entity) -> None:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.entities.attr_name])
    updated_entities = []
    found = False
    for db_entity in db_job.entities or []:
        if db_entity.uid == entity_id:
            updated_entities.append(entity)
            found = True
        else:
            updated_entities.append(db_entity)
    if not found:
        raise EntityNotFoundError(entity_id=entity_id)
    update_job_model(job_id=job_id, actions=[DBJobModel.entities.set(updated_entities)])


def delete_entity(job_id: str, entity_id: str) -> None:
    # Note for future: This requires traversing the stories/tasks for any references to this entity and removing them.
    raise NotImplementedError


def filter_job(
        job: DBJobModel,
        name: str | None,
        status: JobStatus | None,
        exclude_status: JobStatus | None,
        user: str | None,
        event_type: EventType | None,
) -> bool:
    if name and name not in job.name.lower():
        return False

    if status and job.status is not status:
        return False

    if exclude_status and job.status is exclude_status:
        return False

    if user and job.user != user:
        return False

    if event_type:
        task_count = DBGenerationTaskModel.job_id_index.count(
            job.id,
            filter_condition=DBGenerationTaskModel.event_type == event_type
        )
        if not task_count:
            return False

    return True

def _get_job_most_relevant_timestamp(job: DBJobModel) -> str:
    match job.status:
        case JobStatus.Draft:
            return job.drafted_at.isoformat()
        case JobStatus.Pending:
            return job.created_at.isoformat()
        case JobStatus.Generating | JobStatus.Converting | JobStatus.Finalizing:
            return job.started_at.isoformat()
        case JobStatus.Done:
            return job.finished_at.isoformat()
        case JobStatus.Failed | JobStatus.Cancelled:
            return job.started_at.isoformat()
    raise ValueError(f'Unknown job status: {job.status}')

def get_all_jobs(
        page: int,
        page_size: int | None,
        name: str | None,
        status: JobStatus | None,
        exclude_status: JobStatus | None,
        user: str | None,
        event_type: EventType | None,
) -> tuple[list[JobSummary], int]:
    default_page_size = 30
    effective_page_size = page_size or default_page_size

    # Only fetch the fields we need for filtering and display
    attributes_to_get = ['id', 'name', 'status', 'drafted_at', 'created_at', 'started_at', 'finished_at', 'user']

    # First query all the jobs with projection
    jobs_query = DBJobModel.scan(attributes_to_get=attributes_to_get)

    # Then apply the filters using the filter_job function
    filtered_jobs = filter(
        lambda job: filter_job(
            job=job,
            name=name,
            status=status,
            exclude_status=exclude_status,
            user=user,
            event_type=event_type,
        ),
        jobs_query
    )

    # Sort by timestamp ascending
    jobs = sorted(filtered_jobs, key=lambda job: _get_job_most_relevant_timestamp(job), reverse=True)

    # Finally, calculate the total count of filtered jobs and return the results
    total_filtered_count = len(jobs)

    # Paginate the results
    jobs = jobs[(page - 1) * effective_page_size:page * effective_page_size]

    # Return only essential fields for list view
    return [
        JobSummary.model_validate({
            'id': job.id,
            'name': job.name,
            'status': job.status,
            'timestamp': _get_job_most_relevant_timestamp(job),
            'user': job.user,
        })
        for job in jobs
    ], total_filtered_count


def get_all_jobs_matching_prefix(prefix: str) -> list[dict]:
    jobs = DBJobModel.scan(filter_condition=DBJobModel.name.contains(prefix))
    # Sort by creation date descending
    jobs = sorted(jobs, key=lambda job: job.created_at, reverse=True)
    return [job.attribute_values for job in jobs]


def get_job(job_id: str) -> dict:
    #TODO change to calling GenerationJob from UI and add GenerationJob metadata there as well (created_at, etc.)? Or only metadata info?
    job = get_job_model(job_id=job_id)
    return job.attribute_values


def get_job_model(job_id: str, attributes: list[str] | None = None) -> DBJobModel:
    try:
        return DBJobModel.get(job_id, attributes_to_get=attributes)
    except DoesNotExist:
        raise JobNotFoundError(job_id=job_id)


def update_job_model(job_id: str, actions: list[Action]) -> None:
    try:
        DBJobModel(job_id).update(actions=actions, condition=DBJobModel.id.exists())
    except PutError as e:
        raise JobNotFoundError(job_id=job_id) from e


def _update_phase_model(phase_id: str, actions: list[Action]) -> None:
    try:
        DBJobPhaseModel(phase_id).update(actions=actions, condition=DBJobPhaseModel.id.exists())
    except PutError as e:
        raise PhaseNotFoundError(phase_id=phase_id) from e


def update_job_status(job_id: str, status: JobStatus, extraction_size: int = None):
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.tasks.attr_name])
    actions = [DBJobModel.status.set(status)]
    if status is JobStatus.Done:
        if extraction_size is None:
            raise ValueError(f'Missing extraction_size for job {job_id}')
        total_events = sum(task.requested_count for task in db_job.tasks or [])
        actions.extend([
            DBJobModel.size.set(extraction_size),
            DBJobModel.finished_at.set(now()),
            DBJobModel.total_events.set(total_events)
        ])
    elif status is JobStatus.Generating:
        actions.append(DBJobModel.started_at.set(now()))
    elif status is JobStatus.Pending:
        actions.append(DBJobModel.created_at.set(now()))
    update_job_model(job_id=job_id, actions=actions)


def get_job_status(job_id: str) -> JobStatus:
    job = get_job_model(job_id=job_id, attributes=[DBJobModel.status.attr_name])
    return job.status


def delete_job(job_id: str):
    job_tasks = DBGenerationTaskModel.job_id_index.query(job_id)
    job_phases = DBJobPhaseModel.job_id_index.query(job_id)
    job = DBJobModel.get(job_id)
    # Delete any files that may have been written to S3
    dict_attributes = DBJobModel.get_attributes()
    for attr_name, attribute in dict_attributes.items():
        if isinstance(attribute, S3FileAttribute):
            file_field_value = getattr(job, attr_name)
            attribute.delete_s3_object(file_field_value)
    job.delete()
    for task in job_tasks:
        task.delete()
    for phase in job_phases:
        phase.delete()


def build_generation_job(job_id: str) -> GenerationJob:
    db_job = get_job_model(job_id=job_id)
    job = GenerationJob(
        job_id=db_job.id,
        name=db_job.name,
        status=db_job.status,
        context=db_job.device_context,
        device_info=db_job.device_info,
        tasks=_build_root_tasks(db_tasks=db_job.tasks),
        stories=db_job.stories,
        custom_events=db_job.custom_events.values(),
        owner_entity=db_job.owner_entity,
        entities=db_job.entities
    )
    return job


def _build_root_tasks(db_tasks: list[DBGenerationTaskModel]) -> list[GenerationTask]:
    root_tasks = []
    for db_task in db_tasks:
        if db_task.root_task_id is not None:
            continue  # only process root tasks here
        task = deserialize(db_task.params, GenerationTaskAdapter)
        root_tasks.append(task)
    return root_tasks


def add_job_manifest(job_id: str, manifest: Manifest):
    update_job_model(job_id=job_id, actions=[DBJobModel.manifest.set(manifest.model_dump(mode='json'))])


def update_job_k8s_job_name(job_id: str, k8s_job_name: str):
    update_job_model(job_id=job_id, actions=[DBJobModel.k8s_job_name.set(k8s_job_name)])


def get_k8s_job_name(job_id: str) -> str:
    try:
        response = DBJobModel.get(job_id, attributes_to_get=[DBJobModel.k8s_job_name])
    except DoesNotExist:
        raise JobNotFoundError(job_id=job_id)
    return response.k8s_job_name


def insert_phase(job_id: str, phase: TitanPhase):
    db_phase = DBJobPhaseModel(
        id=f'{job_id}_{phase.value}',
        job_id=job_id,
        phase=phase
    )
    db_phase.save(DBJobPhaseModel.id.does_not_exist())


def update_phase_status(job_id: str, phase: TitanPhase, status: PhaseStatus):
    phase_model = _get_phase_by_job_id_and_phase(job_id=job_id, phase=phase)
    if phase_model is None:
        raise PhaseNotFoundError(job_id=job_id, phase=phase)
    phase_model.update(actions=[DBJobPhaseModel.status.set(status)])
    if status is PhaseStatus.Done:
        phase_model.update(
            actions=[DBJobPhaseModel.finished_at.set(now())]
        )


def _get_phase_by_job_id_and_phase(job_id: str, phase: TitanPhase) -> DBJobPhaseModel | None:
    phase_model = DBJobPhaseModel.job_id_index.query(
        job_id, filter_condition=DBJobPhaseModel.phase == phase, limit=1
    )
    for item in phase_model:
        return item
    return None


def _get_phase_by_job_id_and_status(job_id: str, status: PhaseStatus) -> DBJobPhaseModel:
    phase = DBJobPhaseModel.job_id_index.query(
        job_id, filter_condition=DBJobPhaseModel.status == status, limit=1
    )
    if phase is None:
        raise PhaseNotFoundError(job_id=job_id, phase=phase)
    return next(phase)


def delete_job_phases(job_id: str):
    # This method is called when a job fails. All phases are deleted in order to allow re-run.
    for phase in DBJobPhaseModel.job_id_index.query(job_id):
        phase.delete()


def insert_custom_event(job_id: str, custom_event: CustomEvent) -> None:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.custom_events.attr_name])
    db_job.custom_events[custom_event.event_id] = custom_event
    update_job_model(job_id=job_id, actions=[DBJobModel.custom_events.set(db_job.custom_events)])


def update_custom_event(job_id: str, event_id: str, custom_event: CustomEvent) -> None:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.custom_events.attr_name])
    if not event_id in db_job.custom_events:
        raise TaskNotFoundError(task_id=event_id)
    db_job.custom_events[event_id] = custom_event
    update_job_model(job_id=job_id, actions=[DBJobModel.custom_events.set(db_job.custom_events)])


def delete_custom_event(job_id: str, event_id: str) -> None:
    db_job = get_job_model(job_id=job_id, attributes=[DBJobModel.custom_events.attr_name])
    if not event_id in db_job.custom_events:
        raise TaskNotFoundError(task_id=event_id)
    db_job.custom_events.pop(event_id)
    update_job_model(job_id=job_id, actions=[DBJobModel.custom_events.set(db_job.custom_events)])
