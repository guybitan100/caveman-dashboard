from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, PositiveInt, field_validator, SecretStr
from pydantic.types import NonNegativeInt
from pydantic_core.core_schema import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_PATH = Path(__file__).parent.parent.parent.parent.parent.parent.resolve(
    strict=True
)
KB = 1024
MB = 1024 * KB
GB = 1024 * MB


def get_env_dotenv_file() -> str:
    return str(Path(ROOT_PATH, ".env").resolve())


class TitanSettings(BaseSettings):
    VERSION: str
    AWS_REGION: str
    ENVIRONMENT: str
    DEPLOYMENT: Literal["local", "aws"]

    DB_DOCUMENT_DB_BATCH_SIZE: PositiveInt = 10000
    DB_DOCUMENT_DB_URL: str = "docdb.ai.aws.cellebrite.local"
    DB_DOCUMENT_DB_USER: str
    DB_DOCUMENT_DB_PASSWORD: str
    DB_DOCUMENT_DB_CERT_PATH: str

    S3_TITAN_BUCKET_NAME: str
    S3_BUCKET_JOBS_PREFIX: str = "jobs"
    S3_BUCKET_DYNAMO_PREFIX: str = "dynamodb"
    S3_BUCKET_UPLOADS_PREFIX: str = "uploads"
    S3_BUCKET_LOCATION_THUMBNAILS_PREFIX: str = "location_thumbnail"

    METAFINDER_S3_BUCKET_NAME: str
    METAFINDER_MAX_ITEMS: PositiveInt = 10000
    METAFINDER_CLIENT_MAX_CONCURRENCY: PositiveInt = 5
    METAFINDER_HOST: str = "http://localhost:8080"

    METAFINDER_OPENSEARCH_HOST: str = "opensearch.ai.aws.cellebrite.local"
    METAFINDER_OPENSEARCH_USER: str = "deprecated"
    METAFINDER_OPENSEARCH_PASSWORD: str = "deprecated"

    METAFINDER_S3_METADATA_BUCKET_NAME: str = "titan-metafidner-metadata-bucket"
    METAFINDER_S3_METADATA_BUCKET_PREFIX: str = "indexes"
    METAFINDER_ATHENA_OUTPUT_LOCATION: str = (
        "s3://titan-metafidner-metadata-bucket/athena-output"
    )
    METAFINDER_ATHENA_DATABASE_NAME: str = "metafinder"

    API_URL: AnyHttpUrl = "http://localhost:5050"
    API_PORT: int = 5050

    # Old job age for deletion
    JOB_EXPIRY_DAYS: timedelta

    # PA version printed in report.xml
    REPORT_VERSION: str = "7.48"

    # UFDR converter
    MAX_CONVERTER_FILE_DL_WORKERS: PositiveInt = (
        30  # Max threads in executor pool to download from S3
    )
    MAX_FILE_DOWNLOAD_QUEUE_SIZE: NonNegativeInt = (
        1_000  # Max files waiting to download and read, 0 means infinite
    )
    MAX_TOTAL_TEMP_FILES_SIZE_BYTES: PositiveInt = 40 * GB  # temporary files max size
    TEMP_FILE_CHUNK_SIZE: PositiveInt = 8 * MB  # Size of chunks to read from temp files
    MIN_S3_PART_SIZE: PositiveInt = 100 * MB  # Minimum size of S3 part upload

    # Event generation
    MAX_CONCURRENT_TASKS: PositiveInt = (
        4  # Maximum tasks that can be generated concurrently
    )
    MAX_GENERATED_DATA_DB_BUFFER_SIZE: PositiveInt = (
        10_000  # Maximum events (including nested) to hold in memory (hub) waiting to write to DB
    )
    TASK_PROGRESS_UPDATE_EVENT_FREQUENCY: PositiveInt = (
        1_000  # Minimum number of events to update task count progress
    )
    MAX_DYNAMO_S3_ATTR_SIZE_BYTES: PositiveInt = (
        50 * KB
    )  # Maximum size of a DynamoDB attribute value before writing to S3
    STORIES_GRAPH_PICKLE_PROTOCOL: NonNegativeInt = (
        5  # Pickle protocol version to use when pickling stories graph
    )

    CLIENT_INFO_FILE: str = "./../../../../frontend/src/api/clientInfo.json"

    # Dispatcher Configuration
    GENERATE_LOCATION_THUMBNAIL_LAMBDA_NAME: str | None = Field(
        "EngineEnvdevEngineStack78-GenerateLocationThumbnai-SvaLAdrHV0mZ"
    )
    GENERATE_ENTITIES_LAMBDA_NAME: str | None = Field(None)
    GENERATION_JOB_EKS_CLUSTER: str | None = Field(None)
    GENERATION_JOB_EKS_NAMESPACE: str = Field("titan")
    GENERATION_JOB_EKS_IMAGE: str | None = Field(None)
    GENERATION_JOB_EKS_SERVICE_ACCOUNT: str = Field("titan-generation")

    # WebSocket Configuration
    WEBSOCKET_ENDPOINT: str | None = Field(None)
    WEBSOCKET_API_KEY: SecretStr | None = Field(None)
    WEBSOCKET_NAMESPACE: str = Field("default")

    model_config = SettingsConfigDict(
        env_prefix="titan_", env_file=get_env_dotenv_file(), extra="ignore"
    )

    CLIENT_INFO_FILE: str

    model_config = SettingsConfigDict(
        env_prefix="titan_", env_file=get_env_dotenv_file(), extra="ignore"
    )

    @field_validator("JOB_EXPIRY_DAYS", mode="before")
    def validate_timedelta(cls, jobmanager_job_expiry_days) -> timedelta:
        return timedelta(days=int(jobmanager_job_expiry_days))


SETTINGS = TitanSettings()
