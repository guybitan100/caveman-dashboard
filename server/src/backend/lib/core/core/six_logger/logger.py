from typing import Any, Callable

import structlog
from structlog.stdlib import BoundLogger

from core.six_logger.processors import LevelRenamer, Tagger
from core.six_logger.types import Context


class BaseLogger:
    def __init__(self, **kwargs):
        """Configures and returns a structured JSON logger

        For more configurations, see:
        https://www.structlog.org/en/stable/index.html#
        """
        processors = [
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
            structlog.processors.dict_tracebacks,
            Tagger(),
            structlog.processors.EventRenamer("message"),
            LevelRenamer(),
            structlog.processors.JSONRenderer(),
        ]
        self.logger: BoundLogger = structlog.get_logger(processors=processors, **kwargs)

    def bind(self, **kwargs):
        self.logger = self.logger.bind(**kwargs)

    def debug(self, event: str, *args, **kwargs):
        self.logger.debug(event, *args, **kwargs)

    def info(self, event: str, *args, **kwargs):
        self.logger.info(event, *args, **kwargs)

    def warn(self, event: str, *args, **kwargs):
        self.logger.warn(event, *args, **kwargs)

    def error(self, event: str, *args, **kwargs):
        self.logger.error(event, *args, **kwargs)

    def exception(self, event: str, *args, **kwargs):
        self.logger.exception(event, *args, **kwargs)

    def bind_event(self) -> Callable:
        """Decorator that binds the logger with the given event attributes from lambda handler event."""

        def decorator(func: Callable):
            def wrapper(event: dict[str, Any], context: Context | None = None):
                self._bind_event(event)
                self._bind_context(context)
                return func(event, context)

            return wrapper

        return decorator


    def _bind_event(self, event: dict[str, Any]):
        for key, value in event.items():
            self.logger = self.logger.bind(**{key: value})


    def _bind_context(self, context: Context | None):
        if context:
            self.logger = self.logger.bind(
                aws_request_id=context.aws_request_id,
            )



class Logger(BaseLogger):
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance