from networkx import DiGraph
from pynamodb.attributes import (
    TTLAttribute,
    ListAttribute,
    NumberAttribute,
    UnicodeAttribute,
    UTCDateTimeAttribute,
    JSONAttribute,
)
from pynamodb.indexes import AllProjection, GlobalSecondaryIndex
from pynamodb.models import Model, MetaTable

from core.config import SETTINGS
from core.titan_logger import logger
from model.job import DeviceContext
from model.phase import TitanPhase
from model.status import GenerationTaskStatus, JobStatus, PhaseStatus
from model.types import EventType, Entity, DeviceInfoEntry, OwnerEntity
from model.stories import StoryType
from model.utils import str_uuid, now
from titan_db.jobs.attributes import (
    create_enum_attribute,
    create_pydantic_attribute,
    CustomEventsAttribute,
    PickledGraphAttribute,
)
from titan_db.jobs.attributes import create_relationship_set_attribute


def meta_factory(
    table_name: str | None = None, index_name: str | None = None
) -> type[MetaTable]:
    base_dict = {
        "region": SETTINGS.AWS_REGION,
        "write_capacity_units": 1,
        "read_capacity_units": 1,
        "billing_mode": "PAY_PER_REQUEST",
        "tags": {"environment": SETTINGS.ENVIRONMENT, "project": "titan"},
    }

    if index_name:
        base_dict.update({"index_name": index_name, "projection": AllProjection()})

    else:
        if not table_name:
            raise Exception("Either table_name or index_name must be specified")
        base_dict.update(
            {
                "table_name": table_name,
            }
        )

    return type("Meta", (), base_dict)


JobStatusAttribute = create_enum_attribute(JobStatus)
EventTypeAttribute = create_enum_attribute(EventType)
StoryTypeAttribute = create_enum_attribute(StoryType)
GenerationTaskStatusAttribute = create_enum_attribute(GenerationTaskStatus)
TitanPhaseAttribute = create_enum_attribute(TitanPhase)
PhaseStatusAttribute = create_enum_attribute(PhaseStatus)
EntityAttribute = create_pydantic_attribute(Entity)
OwnerEntityAttribute = create_pydantic_attribute(OwnerEntity)
DeviceContextAttribute = create_pydantic_attribute(DeviceContext)
DeviceInfoAttribute = create_pydantic_attribute(DeviceInfoEntry)


class TitanDynamoModel(Model):
    ttl = TTLAttribute(default_for_new=SETTINGS.JOB_EXPIRY_DAYS)


class StoryTaskJobIdIndex(GlobalSecondaryIndex):

    Meta = meta_factory(index_name="story-tasks-job-id-index")

    job_id = UnicodeAttribute(hash_key=True)


class TaskJobIdIndex(GlobalSecondaryIndex):

    Meta = meta_factory(index_name="tasks-job-id-index")

    job_id = UnicodeAttribute(hash_key=True)


class DBGenerationTaskModel(TitanDynamoModel):
    Meta = meta_factory(table_name=f"titan-tasks-{SETTINGS.ENVIRONMENT}")

    task_id = UnicodeAttribute(hash_key=True)
    job_id_index = TaskJobIdIndex()
    job_id = UnicodeAttribute()
    parent_task_id = UnicodeAttribute(null=True)
    root_task_id = UnicodeAttribute(null=True)
    event_type = EventTypeAttribute()
    quantity = NumberAttribute()
    params = JSONAttribute()
    requested_count = NumberAttribute()
    final_count = NumberAttribute(null=True)
    status = GenerationTaskStatusAttribute(default_for_new=GenerationTaskStatus.Pending)
    started_at = UTCDateTimeAttribute(null=True)
    finished_at = UTCDateTimeAttribute(null=True)


GenerationTaskRefAttribute = create_relationship_set_attribute(DBGenerationTaskModel)


class PhaseJobIdIndex(GlobalSecondaryIndex):

    Meta = meta_factory(index_name="phases-job-id-index")

    job_id = UnicodeAttribute(hash_key=True)


class DBJobPhaseModel(TitanDynamoModel):
    Meta = meta_factory(table_name=f"titan-phases-{SETTINGS.ENVIRONMENT}")

    id = UnicodeAttribute(hash_key=True)
    job_id_index = PhaseJobIdIndex()
    job_id = UnicodeAttribute()
    phase = TitanPhaseAttribute()
    status = PhaseStatusAttribute(default=PhaseStatus.Running)
    started_at = UTCDateTimeAttribute(default_for_new=now)
    finished_at = UTCDateTimeAttribute(null=True)


class DBJobModel(TitanDynamoModel):

    Meta = meta_factory(table_name=f"titan-jobs-{SETTINGS.ENVIRONMENT}")

    id = UnicodeAttribute(hash_key=True, default_for_new=str_uuid)
    user = UnicodeAttribute()
    name = UnicodeAttribute()
    status = JobStatusAttribute(default_for_new=JobStatus.Draft)
    drafted_at = UTCDateTimeAttribute(default_for_new=now)
    created_at = UTCDateTimeAttribute(null=True)
    started_at = UTCDateTimeAttribute(null=True)
    finished_at = UTCDateTimeAttribute(null=True)
    phase = TitanPhaseAttribute(null=True)
    owner_entity = OwnerEntityAttribute()
    entities = ListAttribute(of=EntityAttribute, default=list)
    tasks = GenerationTaskRefAttribute(default=list)
    stories = PickledGraphAttribute(default_for_new=DiGraph)
    custom_events = CustomEventsAttribute(default_for_new=dict)
    device_context = DeviceContextAttribute()
    device_info = ListAttribute(of=DeviceInfoAttribute, default=list)
    event_types = ListAttribute(of=EventTypeAttribute, default=list)
    total_events = NumberAttribute(default=0)
    manifest = JSONAttribute(null=True)
    size = NumberAttribute(default=0)
    k8s_job_name = UnicodeAttribute(null=True)


tables = [DBJobModel, DBJobPhaseModel, DBGenerationTaskModel]


def create_tables(force: bool = False):
    if force:
        delete_tables()
    for table in tables:
        if not table.exists():
            logger.info(f"Creating table {table.Meta.table_name}")
            table.create_table(wait=True)


def delete_tables():
    for table in tables:
        if table.exists():
            logger.info(f"Deleting table {table.Meta.table_name}")
            table.delete_table()
