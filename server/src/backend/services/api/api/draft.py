import random
from datetime import date
from functools import wraps
from typing import Callable

import numpy as np
import randomname
from pydantic import BaseModel, PositiveInt, confloat, field_validator

from api.device_info import generate_initial_device_info, generate_updated_device_info
from api.random_events import event_type_to_weight
from api.validator import validate_task
from metafinder_client.client import MetaFinderClient
from model.device_models import DEVICE_MODELS
from model.job import GenerationJob, DeviceContext, CustomEvent
from model.tasks import GenerationTask, GenerationTaskAdapter
from model.common import CreateDraftJobRequest, DraftJobOperationResponse
from model.status import ValidationStatus, JobStatus
from model.stories import StoryData
from model.types import Entity, DeviceInfoEntry, EventType, OwnerEntity
from simulation_utils.entities import generate_entity
from titan_db.jobs import db_job_utils, db_task_utils, db_story_utils


def create_job(request: CreateDraftJobRequest) -> GenerationJob:
    name = request.name or randomname.get_name()
    device = random.choice(DEVICE_MODELS)
    end_date = date.today()
    owner_entity = generate_entity(country_info=None, is_owner=True)
    device_context = DeviceContext(
        device=device,
        start_date=end_date.replace(year=end_date.year - 1),
        end_date=end_date
    )
    device_info = generate_initial_device_info(context=device_context)
    job_id = db_job_utils.insert_job(
        user=request.user,
        name=name,
		owner_entity=owner_entity,
        device_context=device_context,
        device_info=device_info
    )
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def verify_job_is_draft(route_func: Callable) -> Callable:
    @wraps(route_func)
    def wrapper(job_id: str, *args, **kwargs):
        status = db_job_utils.get_job_status(job_id=job_id)
        if status is not JobStatus.Draft:
            raise Exception(f"Job {job_id} is not a draft and cannot be modified")
        return route_func(job_id, *args, **kwargs)
    return wrapper


def update_job_name(job_id: str, name: str) -> GenerationJob:
    db_job_utils.update_job_name(job_id=job_id, name=name)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_device_context(job_id: str, device_context: DeviceContext) -> GenerationJob:
    job_device_info = db_job_utils.get_device_info(job_id=job_id)
    device_info = generate_updated_device_info(context=device_context, device_info=job_device_info)
    db_job_utils.update_device_context_and_info(job_id=job_id, device_context=device_context, device_info=device_info)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_device_info(job_id: str, device_info: list[DeviceInfoEntry]) -> GenerationJob:
    db_job_utils.update_device_info(job_id=job_id, device_info=device_info)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_owner_entity(job_id: str, entity: OwnerEntity) -> GenerationJob:
    db_job_utils.update_owner_entity(job_id=job_id, entity=entity)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


class RandomEventsRequest(BaseModel):
    total_events: PositiveInt
    event_weights: dict[EventType, confloat(ge=0.0, le=1.0)] | None = None

    @field_validator('event_weights')
    @classmethod
    def validate_event_weights(cls, v):
        # If dict is a dict with any entries, sum the values and ensure sum > 0
        if v and sum(v.values()) <= 0:
            raise ValueError('Sum of weights must be greater than zero')


def create_random_events(job_id: str, total_events: int, event_weights: dict[EventType, float] | None) -> GenerationJob:
    event_weights = event_weights or event_type_to_weight
    # Normalize weights to sum to 1
    total_weight = sum(event_weights.values())
    event_weights = {event_type: weight / total_weight for event_type, weight in event_weights.items()}
    quantities = np.random.multinomial(n=total_events, pvals=tuple(event_weights.values())).tolist()
    tasks = [
        GenerationTaskAdapter.validate_python(
            {
                'event_type': event_type,
                'quantity': quantity
            }
        )
        for event_type, quantity in zip(event_weights, quantities) if quantity > 0
    ]
    db_task_utils.insert_tasks(job_id=job_id, tasks=tasks)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def create_task(job_id: str, task: GenerationTask, metafinder_client: MetaFinderClient) -> DraftJobOperationResponse:
    validation = validate_task(task=task, metafinder_client=metafinder_client)
    if validation.status is ValidationStatus.Failure:
        return DraftJobOperationResponse(validation=validation)
    db_task_utils.insert_task(job_id=job_id, task=task)     # Insert task (and sub-tasks) into DB
    job = db_job_utils.build_generation_job(job_id=job_id)
    return DraftJobOperationResponse(job=job, validation=validation)


def update_task(
        job_id: str,
        task_id: str,
        task: GenerationTask,
        metafinder_client: MetaFinderClient
) -> DraftJobOperationResponse:
    validation = validate_task(task=task, metafinder_client=metafinder_client)
    if validation.status is ValidationStatus.Failure:
        return DraftJobOperationResponse(validation=validation)
    db_task_utils.update_task(job_id=job_id, task_id=task_id, task=task)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return DraftJobOperationResponse(job=job, validation=validation)


def delete_task(job_id: str, task_id: str) -> GenerationJob:
    db_task_utils.delete_task(job_id=job_id, task_id=task_id)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def create_story(job_id: str, story: StoryData) -> GenerationJob:
    db_story_utils.insert_story(job_id=job_id, story=story)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def create_stories(job_id: str, stories: list[StoryData]) -> GenerationJob:
    db_story_utils.insert_stories(job_id=job_id, stories=stories)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_story(job_id: str, story_id: str, story: StoryData) -> GenerationJob:
    db_story_utils.update_story(job_id=job_id, story_id=story_id, story=story)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def delete_story(job_id: str, story_id: str) -> GenerationJob:
    db_story_utils.delete_story(job_id=job_id, story_id=story_id)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def create_custom_event(job_id: str, custom_event: CustomEvent) -> GenerationJob:
    db_job_utils.insert_custom_event(job_id=job_id, custom_event=custom_event)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_custom_event(job_id: str, event_id: str, custom_event: CustomEvent) -> GenerationJob:
    db_job_utils.update_custom_event(job_id=job_id, event_id=event_id, custom_event=custom_event)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def delete_custom_event(job_id: str, event_id: str) -> GenerationJob:
    db_job_utils.delete_custom_event(job_id=job_id, event_id=event_id)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def create_entity(job_id: str, entity: Entity) -> GenerationJob:
    return create_entities(job_id=job_id, entities=[entity])


def create_entities(job_id: str, entities: list[Entity]) -> GenerationJob:
    db_job_utils.insert_entities(job_id=job_id, entities=entities)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def update_entity(job_id: str, entity_id: str, entity: Entity) -> GenerationJob:
    db_job_utils.update_entity(job_id=job_id, entity_id=entity_id, entity=entity)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def delete_entity(job_id: str, entity_id: str) -> GenerationJob:
    db_job_utils.delete_entity(job_id=job_id, entity_id=entity_id)
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job
