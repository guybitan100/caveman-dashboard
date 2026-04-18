from structlog import PrintLogger

from core.titan_logger.settings import logging_settings


class LevelRenamer:
    """Adds log level with a custom key to the log, so that Datadog can parse it."""

    def __call__(self, logger: PrintLogger, method_name: str, event_dict: dict):
        event_dict["level"] = method_name
        return event_dict


class Tagger:
    """Adds tags to the log, so that Datadog can parse them. Tags are read from environment variables."""

    def __call__(self, logger: PrintLogger, method_name: str, event_dict: dict):
        event_dict["logger"] = "titan"

        if logging_settings.service:
            event_dict["service"] = logging_settings.service

        if logging_settings.env:
            event_dict["env"] = logging_settings.env

        if logging_settings.version:
            event_dict["version"] = logging_settings.version

        if logging_settings.job_id:
            event_dict["jobId"] = logging_settings.job_id

        return event_dict
    