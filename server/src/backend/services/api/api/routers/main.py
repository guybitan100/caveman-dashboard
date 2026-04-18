from fastapi import APIRouter, Depends, HTTPException

from api.models import JobsListResponse, TaskProgressResponse, GenerateEntityRequest
from core import routes
from core.titan_logger import logger
from core.s3_client import TitanS3Client
from api import operations, uploads
from api.dispatcher import Dispatcher
from model.device_models import DeviceModel, DEVICE_MODELS
from model.job import GenerationJob
from model.status import JobStatus
from model.types import EventType
from model.uploads import UploadedChatStory
from simulation_utils.entities import generate_entities

router = APIRouter(
    prefix=routes.API_PREFIX,
    responses={404: {'description': 'Not found'}},
)


@router.get(f'{routes.DOWNLOAD}{routes.JOB_ID}')
async def download(job_id, s3_client: TitanS3Client = Depends(TitanS3Client)):
    return operations.download_ufdr(job_id=job_id, s3_client=s3_client)


@router.post(f'{routes.UPLOAD_FILE}{routes.FILE_NAME}')
def upload_file(file_name: str, s3_client: TitanS3Client = Depends(TitanS3Client)):
    return operations.get_upload_presigned_url(file_name=file_name, s3_client=s3_client)


@router.get(f'{routes.UPLOAD_FILE}{routes.FILE_MD5}')
def does_uploaded_file_exists(file_md5: str, s3_client: TitanS3Client = Depends(TitanS3Client)):
    return operations.does_uploaded_file_exists(file_md5=file_md5, s3_client=s3_client)


@router.post(f'{routes.GENERATE}{routes.ENTITY}')
def generate_entity(request: GenerateEntityRequest):
    return generate_entities(n=request.count, country_info=request.country_info)


## Job Router
@router.post(f'{routes.API_JOB_ROUTER_PREFIX}{routes.JOB_ID}')
def run_job(job_id: str, dispatcher: Dispatcher = Depends(Dispatcher)) -> GenerationJob:
    job = operations.run_job(job_id=job_id, dispatcher=dispatcher)
    return job


@router.get(f'{routes.API_JOB_ROUTER_PREFIX}{routes.JOB_ID}')
def get_job(job_id: str) -> GenerationJob:
    #TODO this is for Jobs panel? needs to include metadata in addition to GenerationJob
    job = operations.get_job(job_id=job_id)
    return job


@router.put(f'{routes.API_JOB_ROUTER_PREFIX}{routes.JOB_ID}')
def re_run_job(job_id: str, dispatcher: Dispatcher = Depends(Dispatcher)) -> GenerationJob:
    job = operations.re_run_job(job_id=job_id, dispatcher=dispatcher)
    return job


@router.delete(f'{routes.API_JOB_ROUTER_PREFIX}{routes.JOB_ID}')
def delete_job(job_id: str, dispatcher: Dispatcher = Depends(Dispatcher)) -> str:
    try:
        job_id = operations.delete_job(job_id=job_id, dispatcher=dispatcher)
        return job_id
    except Exception as e:
        logger.error(e)
        raise HTTPException(status_code=500, detail=f'Could not delete job {job_id}')


@router.post(f'{routes.API_JOB_ROUTER_PREFIX}{routes.CANCEL}{routes.JOB_ID}')
def cancel_job(job_id: str, dispatcher: Dispatcher = Depends(Dispatcher)) -> str:
    operations.cancel_job(job_id=job_id, dispatcher=dispatcher)
    return job_id


# Jobs Router

@router.get(f'{routes.API_JOBS_ROUTER_PREFIX}{routes.PREFIX}')
async def get_all_jobs_matching_prefix(prefix: str) -> list[dict]:
    return operations.get_all_jobs_matching_prefix(prefix=prefix)


@router.get(routes.API_JOBS_ROUTER_PREFIX)
def get_all_jobs(
    page: int,
    page_size: int | None = None,
    name: str | None = None,
    status: JobStatus | None = None,
    exclude_status: JobStatus | None = None,
    user: str | None = None,
    event_type: EventType | None = None,
) -> JobsListResponse:
    jobs, total_count = operations.get_all_jobs(
        page=page,
        page_size=page_size,
        name=name,
        status=status,
        exclude_status=exclude_status,
        user=user,
        event_type=event_type
    )
    return JobsListResponse(
        jobs=jobs,
        total=total_count
    )


@router.get(f"{routes.API_JOB_ROUTER_PREFIX}{routes.TASK_PROGRESS}{routes.TASK_ID}")
def get_task_progress(task_id: str) -> TaskProgressResponse:
    status, progress = operations.get_task_progress(task_id=task_id)
    return TaskProgressResponse(
        task_id=task_id,
        status=status,
        progress=progress
    )


@router.post(f'{routes.API_STORY_ROUTER_PREFIX}{routes.UPLOAD_CHAT}')
def upload_chat(chat: UploadedChatStory):
    return uploads.convert_uploaded_data(uploaded_data=chat)


@router.get(routes.DEVICE_MODELS)
def get_device_models() -> list[DeviceModel]:
    return DEVICE_MODELS
