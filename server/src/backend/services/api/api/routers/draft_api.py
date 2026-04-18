from fastapi import APIRouter, Depends, Body

from api import draft
from api.draft import verify_job_is_draft, RandomEventsRequest
from core import routes
from metafinder_client.client import MetaFinderClient
from model.job import DeviceContext, CustomEvent, GenerationJob
from model.common import CreateDraftJobRequest, DraftJobOperationResponse
from model.tasks import GenerationTaskUnion
from model.stories import StoryDataUnion
from model.types import Entity, DeviceInfoEntry, OwnerEntity

draft_router = APIRouter(
    prefix=routes.API_PREFIX,
    responses={404: {'description': 'Not found'}},
)

@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}')
def create_job(request: CreateDraftJobRequest) -> GenerationJob:
    return draft.create_job(request=request)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.NAME}')
@verify_job_is_draft
def update_job_name(job_id: str, name: str) -> GenerationJob:
    return draft.update_job_name(job_id=job_id, name=name)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.DEVICE_CONTEXT}')
@verify_job_is_draft
def update_device_context(job_id: str, device_context: DeviceContext) -> GenerationJob:
    return draft.update_device_context(job_id=job_id, device_context=device_context)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.DEVICE_INFO}')
@verify_job_is_draft
def update_device_info(job_id: str, device_info: list[DeviceInfoEntry]) -> GenerationJob:
    return draft.update_device_info(job_id=job_id, device_info=device_info)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.OWNER_ENTITY}')
@verify_job_is_draft
def update_owner_entity(job_id: str, entity: OwnerEntity) -> GenerationJob:
    return draft.update_owner_entity(job_id=job_id, entity=entity)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.RANDOM_EVENTS}')
@verify_job_is_draft
def create_random_events(job_id: str, request: RandomEventsRequest) -> GenerationJob:
    return draft.create_random_events(
		job_id=job_id,
		total_events=request.total_events,
		event_weights=request.event_weights
	)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.TASK}')
@verify_job_is_draft
def create_task(
        job_id: str,
        task: GenerationTaskUnion = Body(),
        metafinder_client: MetaFinderClient = Depends()
) -> DraftJobOperationResponse:
    return draft.create_task(job_id=job_id, task=task, metafinder_client=metafinder_client)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.TASK}')
@verify_job_is_draft
def update_task(
        job_id: str,
        task_id: str,
        task: GenerationTaskUnion = Body(),
        metafinder_client: MetaFinderClient = Depends()
) -> DraftJobOperationResponse:
    return draft.update_task(job_id=job_id, task_id=task_id, task=task, metafinder_client=metafinder_client)


@draft_router.delete(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.TASK}')
@verify_job_is_draft
def delete_task(job_id: str, task_id: str) -> GenerationJob:
    return draft.delete_task(job_id=job_id, task_id=task_id)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.STORY}')
@verify_job_is_draft
def create_story(job_id: str, story: StoryDataUnion = Body()) -> GenerationJob:
    return draft.create_story(job_id=job_id, story=story)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.STORIES}')
@verify_job_is_draft
def create_stories(job_id: str, stories: list[StoryDataUnion] = Body()) -> GenerationJob:
    return draft.create_stories(job_id=job_id, stories=stories)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.STORY}')
@verify_job_is_draft
def update_story(job_id: str, story_id: str, story: StoryDataUnion = Body()) -> GenerationJob:
    return draft.update_story(job_id=job_id, story_id=story_id, story=story)


@draft_router.delete(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.STORY}')
@verify_job_is_draft
def delete_story(job_id: str, story_id: str) -> GenerationJob:
    return draft.delete_story(job_id=job_id, story_id=story_id)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.CUSTOM_EVENT}')
@verify_job_is_draft
def create_custom_event(job_id: str, custom_event: CustomEvent = Body()) -> GenerationJob:
    return draft.create_custom_event(job_id=job_id, custom_event=custom_event)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.CUSTOM_EVENT}')
@verify_job_is_draft
def update_custom_event(job_id: str, event_id: str, custom_event: CustomEvent = Body()) -> GenerationJob:
    return draft.update_custom_event(job_id=job_id, event_id=event_id, custom_event=custom_event)


@draft_router.delete(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.CUSTOM_EVENT}')
@verify_job_is_draft
def delete_custom_event(job_id: str, event_id: str) -> GenerationJob:
    return draft.delete_custom_event(job_id=job_id, event_id=event_id)


@draft_router.post(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.ENTITY}')
@verify_job_is_draft
def create_entity(job_id: str, entity: Entity) -> GenerationJob:
    return draft.create_entity(job_id=job_id, entity=entity)


@draft_router.put(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.ENTITY}')
@verify_job_is_draft
def update_entity(job_id: str, entity_id: str, entity: Entity) -> GenerationJob:
    return draft.update_entity(job_id=job_id, entity_id=entity_id, entity=entity)


@draft_router.delete(f'{routes.API_DRAFT_ROUTER_PREFIX}{routes.JOB_ID}{routes.ENTITY}')
@verify_job_is_draft
def delete_entity(job_id: str, entity_id: str) -> GenerationJob:
    return draft.delete_entity(job_id=job_id, entity_id=entity_id)
