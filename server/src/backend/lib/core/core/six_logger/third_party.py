import logging
import sys

from pythonjsonlogger import jsonlogger

from core.six_logger.settings import logging_settings


# Make the standard logger use JSON format
# So that 3rd party libraries that use the standard logger will also be formatted in JSON
def configure_standard_logger() -> None:
    handler = logging.StreamHandler(sys.stdout)

    static_fields = {
        "logger": "six",
    }

    if logging_settings.service:
        static_fields["service"] = logging_settings.service

    if logging_settings.env:
        static_fields["env"] = logging_settings.env

    if logging_settings.version:
        static_fields["version"] = logging_settings.version

    if logging_settings.job_id:
        static_fields["jobId"] = logging_settings.job_id

    formatter = jsonlogger.JsonFormatter(
        rename_fields={},
        static_fields=static_fields,
        timestamp=True,
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)