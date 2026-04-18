from core.titan_logger.logger import BaseLogger, Logger


class TestBaseLogger:
    def test_bind(self):
        log = BaseLogger()
        log.bind(key="value")

    def test_debug(self):
        log = BaseLogger()
        log.debug("test debug")

    def test_info(self):
        log = BaseLogger()
        log.info("test info")

    def test_warn(self):
        log = BaseLogger()
        log.warn("test warn")

    def test_error(self):
        log = BaseLogger()
        log.error("test error")

    def test_exception(self):
        log = BaseLogger()
        try:
            raise ValueError("test")
        except Exception:
            log.exception("test exception")

    def test_bind_event_decorator(self):
        log = BaseLogger()

        @log.bind_event()
        def handler(event, context=None):
            return "handled"

        result = handler({"job_id": "j1"})
        assert result == "handled"

    def test_bind_event_with_context(self):
        log = BaseLogger()

        @log.bind_event()
        def handler(event, context=None):
            return "handled"

        from unittest.mock import MagicMock
        ctx = MagicMock()
        ctx.aws_request_id = "req1"
        result = handler({"job_id": "j1"}, context=ctx)
        assert result == "handled"


class TestLogger:
    def test_singleton(self):
        l1 = Logger()
        l2 = Logger()
        assert l1 is l2
