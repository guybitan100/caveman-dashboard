import os

from core.config import SETTINGS


class LoggingSettings:
    @property
    def env(self) -> str | None:
        return SETTINGS.ENVIRONMENT

    @property
    def service(self) -> str | None:
        return os.getenv("SERVICE")

    @property
    def version(self) -> str | None:
        return SETTINGS.VERSION

    @property
    def job_id(self) -> str | None:
        return os.getenv("JOB_ID")



logging_settings = LoggingSettings()