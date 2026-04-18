import os
import signal

from core.appsync_client import AppsyncClient
from core.six_logger import logger
from generation import engine
from generation.conversion import converter
from model.status import JobStatus
from six_db.jobs import db_job_utils
from six_db.events import db

appsync_client = AppsyncClient()


def run_job(job_id: str):
    try:
        logger.info("Starting job", job_id=job_id)
        update_job_status(job_id=job_id, status=JobStatus.Generating)
        job = db_job_utils.build_generation_job(job_id=job_id)
        engine.initialize(job=job)
        engine.generate(job=job)
        update_job_status(job_id=job_id, status=JobStatus.Converting)
        converter.convert(job=job)
        update_job_status(job_id=job_id, status=JobStatus.Finalizing)
        extraction_size = engine.finalize(job=job)
        update_job_status(job_id=job_id, status=JobStatus.Done, extraction_size=extraction_size)
        logger.info("Job done", job_id=job_id)
    except Exception as e:
        update_job_status(job_id=job_id, status=JobStatus.Failed)
        db.delete_job(job_id=job_id, raise_error_on_missing=False)
        logger.error(f"Job failed: {e}", job_id=job_id, error=e)
        raise e


def update_job_status(job_id: str, status: JobStatus, extraction_size: int = None):
    db_job_utils.update_job_status(job_id=job_id, status=status, extraction_size=extraction_size)
    appsync_client.publish_event(
        events=[{
                "id": job_id,
                "status": status,
            }],
        channel="jobs"
    )


def shutdown(signum, frame):
    logger.info('Caught SIGTERM, shutting down')
    exit(0)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, shutdown)
    _job_id = os.environ["JOB_ID"]
    run_job(job_id=_job_id)
