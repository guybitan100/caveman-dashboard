from core.config import SETTINGS
from core.s3_client import SixS3Client
from core.six_logger import logger
from model.tasks import EventTask
from model.phase import SixPhase
from model.types import EventType, DeviceInfo
from model.job import GenerationJob
from six_db.events import db
from generation.utils import six_phase
from generation import social_db
from generation.simulation.social import initialize_social_context
from generation.simulation.hub import TaskGenerationHub
from generation.stories import publisher
from generation import foreman


@six_phase(phase=SixPhase.Initialization)
def initialize(job: GenerationJob):
    db.initialize_job_collection(job_id=job.job_id)

    logger.info("Setting up device...", job_id=job.job_id)
    _setup_device(job=job)

    logger.info("Initializing social network...", job_id=job.job_id)
    context = initialize_social_context(job=job)
    logger.info(
        f"Social network initialized with {len(context.entities)} entities",
        job_id=job.job_id, emit = True
    )
    social_db.write_social_context(job_id=job.job_id, social_context=context)


@six_phase(phase=SixPhase.Generation)
def generate(job: GenerationJob):
    if job.stories.nodes:
        logger.info("Generating stories...", job_id=job.job_id)
        publisher.publish(job_id=job.job_id, stories_graph=job.stories)
        logger.info("Generated stories", job_id=job.job_id)

    if not job.tasks:
        logger.info(f"No events to generate", job_id=job.job_id)
        return

    # Load social context from DB
    context = social_db.read_social_context(job_id=job.job_id)

    logger.info("Generating events...", job_id=job.job_id)
    hub = TaskGenerationHub(job=job, context=context)
    hub.generate_events()
    logger.info("Generated events", job_id=job.job_id)


@six_phase(phase=SixPhase.Finalization)
def finalize(job: GenerationJob) -> int:
    logger.info('Deleting generated data from DB', job_id=job.job_id)
    ufdr_path = f'{SETTINGS.S3_BUCKET_JOBS_PREFIX}/{job.job_id}/{job.name}.ufdr'
    s3_client = SixS3Client()
    extraction_size = s3_client.get_file_size(bucket_name=SETTINGS.S3_SIX_BUCKET_NAME, file_name=ufdr_path)
    db.delete_job(job_id=job.job_id)
    logger.info(f'Deleted generated data from DB ({extraction_size=})', job_id=job.job_id)
    return extraction_size


def _setup_device(job: GenerationJob) -> None:
    # Device info
    _create_device_info(job=job)
    # Install applications
    _install_apps(job=job)


def _create_device_info(job: GenerationJob) -> None:
    device_info = DeviceInfo(entries=job.device_info)
    db.write_device_info(job_id=job.job_id, device_info=device_info)


def _install_apps(job: GenerationJob) -> None:
    # Collect custom apps from all tasks before querying metafinder
    app_ids = list(
        set(
            task.app_id  # set for de-duplicating app IDs
            for task in job.tasks  # For each task
            if isinstance(task, EventTask) and task.app_id is not None
        )
    )
    app_contractor = foreman.hire_contractor(event_type=EventType.APP, job=job)
    apps = app_contractor.construct_by_ids(app_ids=app_ids)
    db.write_events(job_id=job.job_id, events=apps)
