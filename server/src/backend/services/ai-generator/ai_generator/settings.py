from core.config import get_env_dotenv_file
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="titan_", env_file=get_env_dotenv_file(), extra="ignore"
    )

    LITELLM_API_KEY: SecretStr
    LITELLM_BASE_URL: str
    MEDIA_GENERATION_BATCH_SIZE: int
    MEDIA_GENERATION_RETRY_ATTEMPTS: int
    MEDIA_GENERATION_ENABLED: bool

    # Bedrock settings
    BEDROCK_REGION: str = "us-east-1"
    BEDROCK_IMAGE_MODEL: str = "amazon.nova-canvas-v1:0"
    BEDROCK_VIDEO_MODEL: str = "amazon.nova-reel-v1:0"
    BEDROCK_AUDIO_MODEL: str = "amazon.nova-sonic-v1:0"

    # Video generation polling settings
    VIDEO_GENERATION_POLL_INTERVAL: int = 10  # seconds between polls
    VIDEO_GENERATION_TIMEOUT: int = 600  # max seconds to wait (10 minutes)

    S3_TITAN_BUCKET_NAME: str

    S3_UPLOADS_PREFIX: str = "uploads"

    # Routine generation settings
    ROUTINE_GENERATION_ENABLED: bool = True
    ROUTINE_GENERATION_DENSITY: str = "heavy"  # light, medium, heavy
    ROUTINE_GENERATION_TIMING_VARIATION: int = 30  # minutes ±
    ROUTINE_GENERATION_DURATION_VARIATION: float = 0.5  # percentage ±
    ROUTINE_GENERATION_ENTITY_AWARE_SKIP: bool = True
    ROUTINE_GENERATION_ADJUST_FOR_TIMELINE: bool = True
    ROUTINE_GENERATION_TIMELINE_BUFFER: int = 60  # minutes


SETTINGS = Settings()

