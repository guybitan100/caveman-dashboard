from core.config import SETTINGS
from core.s3_client import TitanS3Client
from core.titan_logger import logger
from api.dispatcher import Dispatcher
from api.uploads import verify_uploaded_files_exist_or_fail
from model.uploads import UploadedFilePresignedUrl
from titan_db.jobs import db_job_utils, db_task_utils
from titan_db.events import db as events_db
from model.common import JobSummary
from model.job import GenerationJob
from model.status import JobStatus, GenerationTaskStatus
from model.types import EventType


def run_job(job_id: str, dispatcher: Dispatcher) -> GenerationJob:
    """Runs a draft generation job by its ID."""
    job = db_job_utils.build_generation_job(job_id=job_id)
    verify_uploaded_files_exist_or_fail(job=job)
    db_job_utils.update_job_status(job_id=job_id, status=JobStatus.Pending)
    ecs_task_id = dispatcher.run_generation_job(job_id=job_id)
    db_job_utils.update_job_ecs_task_id(job_id=job_id, ecs_task_id=ecs_task_id)
    job.status = JobStatus.Pending
    return job


def re_run_job(job_id: str, dispatcher: Dispatcher) -> GenerationJob:
    """Re-runs an existing job by its ID."""
    try:
        status = db_job_utils.get_job_status(job_id=job_id)
        if status is JobStatus.Draft:
            raise Exception(f"Job is still a draft")
        db_job_utils.delete_job_phases(job_id=job_id)
        db_job_utils.update_job_status(job_id=job_id, status=JobStatus.Pending)
        ecs_task_id = dispatcher.run_generation_job(job_id=job_id)
        db_job_utils.update_job_ecs_task_id(job_id=job_id, ecs_task_id=ecs_task_id)
        job = db_job_utils.build_generation_job(job_id=job_id)
        return job
    except Exception as e:
        logger.error(f'Could not re-run job', job_id=job_id, error=e)
        raise Exception(f'Could not re-run job {job_id}: {e}')


def cancel_job(job_id: str, dispatcher: Dispatcher) -> bool:
    """Cancels a running job by its ID. Returns True if the job was canceled, False if it was not running."""
    status = db_job_utils.get_job_status(job_id=job_id)
    
    match status:
        case JobStatus.Done | JobStatus.Failed | JobStatus.Pending | JobStatus.Cancelled | JobStatus.Draft:
            logger.info(f'Job is not running, no need to cancel it', job_id=job_id)
            return False
        
        case JobStatus.Generating | JobStatus.Converting | JobStatus.Finalizing:
            ecs_task_id = db_job_utils.get_ecs_task_id(job_id=job_id)
            canceled = dispatcher.stop_generation_job(ecs_task_id=ecs_task_id)
            if not canceled:
                raise Exception(f'Could not cancel job {job_id}')
            db_job_utils.update_job_status(job_id=job_id, status=JobStatus.Cancelled)
            return canceled
    
    raise Exception(f'Could not cancel job {job_id}')


def delete_job(job_id: str, dispatcher: Dispatcher) -> str:
    """Deletes a job by its ID after ensuring it is not running and returns its ID."""
    status = db_job_utils.get_job_status(job_id=job_id)

    # check if job isn't running so we can safely delete it from the DB:
    match status:
        case JobStatus.Done | JobStatus.Failed | JobStatus.Pending | JobStatus.Cancelled | JobStatus.Draft:
            _delete_job(job_id=job_id)
            return job_id
        
        case JobStatus.Generating | JobStatus.Converting | JobStatus.Finalizing:
            cancel_job(job_id=job_id, dispatcher=dispatcher)
            _delete_job(job_id=job_id)
            return job_id
    
    raise Exception(f'Could not delete job {job_id}')


def get_all_jobs(
        page: int,
        page_size: int | None,
        name: str | None,
        status: JobStatus | None,
        exclude_status: JobStatus | None,
        user: str | None,
        event_type: EventType | None,
) -> tuple[list[JobSummary], int]:
    jobs, total_count = db_job_utils.get_all_jobs(
        page=page,
        page_size=page_size,
        name=name,
        status=status,
        exclude_status=exclude_status,
        user=user,
        event_type=event_type,
    )
    return jobs, total_count


def get_task_progress(task_id: str) -> tuple[GenerationTaskStatus, float]:
    return db_task_utils.get_task_progress(task_id=task_id)


def get_all_jobs_matching_prefix(prefix: str) -> list[dict]:
    return db_job_utils.get_all_jobs_matching_prefix(prefix=prefix)


def get_job_status(job_id: str) -> JobStatus:
    job_status = db_job_utils.get_job_status(job_id=job_id)
    return job_status


def get_job(job_id: str) -> GenerationJob:
    job = db_job_utils.build_generation_job(job_id=job_id)
    return job


def _delete_job(job_id: str) -> None:
    events_db.delete_job(job_id=job_id, raise_error_on_missing=False)
    db_job_utils.delete_job(job_id=job_id)


def download_ufdr(job_id: str, s3_client: TitanS3Client) -> dict:
    logger.info(f'Request to download UFDR for job', job_id=job_id)
    job = get_job(job_id=job_id)
    ufdr_path = f'{SETTINGS.S3_BUCKET_JOBS_PREFIX}/{job_id}/{job.name}.ufdr'
    presigned_url = s3_client.get_download_presigned_url(bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME, file_name=ufdr_path)
    file_size = s3_client.get_file_size(bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME, file_name=ufdr_path)
    return {
        "url": presigned_url,
        "file_size": file_size,
        "file_name": f"{job.name}.ufdr"
    }


def _construct_uploaded_file_path(file_name: str) -> str:
    return f'{SETTINGS.S3_BUCKET_UPLOADS_PREFIX}/{file_name}'


def does_uploaded_file_exists(file_md5: str, s3_client: TitanS3Client) -> bool:
    prefix = _construct_uploaded_file_path(file_name=file_md5)
    return s3_client.does_prefix_exist(prefix=prefix, bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME)


def get_upload_presigned_url(file_name: str, s3_client: TitanS3Client) -> UploadedFilePresignedUrl:
    file_name = _construct_uploaded_file_path(file_name=file_name)
    result = s3_client.get_upload_presigned_url(file_name=file_name, bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME)
    return result
