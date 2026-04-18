from model.tasks import ChatTask, AudioTask
from model.types import EventType


audio_task = AudioTask(quantity=2)
audio_task.task_id = "53ab0eb4-894d-4604-b554-4b7f68e5b96b"
audio_task.parent_task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
audio_task.root_task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
chat_task_with_attachments = ChatTask(quantity=15, attachments=[audio_task])
chat_task_with_attachments.task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
chat_task_with_attachments.parent_task_id = None
chat_task_with_attachments.root_task_id = None


audio_task = AudioTask(quantity=2)
audio_task.task_id = "53ab0eb4-894d-4604-b554-4b7f68e5b96b"
audio_task.parent_task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
audio_task.root_task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
chat_task_with_voice_messages = ChatTask(
    quantity=15, voice_messages_quantity=2, voice_messages_task=audio_task
)
chat_task_with_voice_messages.task_id = "18b7b259-96d2-4c48-8888-c13ffaae08a6"
chat_task_with_voice_messages.parent_task_id = None
chat_task_with_voice_messages.root_task_id = None


def test_get_sub_tasks_of_attachments():
    sub_tasks = list(chat_task_with_attachments.get_sub_tasks())
    assert len(sub_tasks) == 1
    assert sub_tasks[0].task_id == "53ab0eb4-894d-4604-b554-4b7f68e5b96b"
    assert sub_tasks[0].event_type is EventType.AUDIO
    assert sub_tasks[0].quantity == 2


def test_get_sub_tasks_of_voice_messages():
    sub_tasks = list(chat_task_with_voice_messages.get_sub_tasks())
    assert len(sub_tasks) == 1
    assert sub_tasks[0].task_id == "53ab0eb4-894d-4604-b554-4b7f68e5b96b"
    assert sub_tasks[0].event_type is EventType.AUDIO
    assert sub_tasks[0].quantity == 2


import pytest
from datetime import date
from model.job import DeviceContext, validate_country_info, CustomEvent
from model.device_models import DEVICE_MODELS


class TestValidateCountryInfo:
    def test_none(self):
        assert validate_country_info(None) is None

    def test_string(self):
        result = validate_country_info("United States")
        assert result is not None

    def test_passthrough(self):
        from model.country_info import COUNTRY_INFOS

        ci = COUNTRY_INFOS["United States"]
        assert validate_country_info(ci) is ci


class TestDeviceContext:
    def test_basic(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
        )
        assert dc.start_date == date(2023, 1, 1)

    def test_end_before_start_raises(self):
        with pytest.raises(ValueError, match="must be later"):
            DeviceContext(
                device=DEVICE_MODELS[0],
                start_date=date(2024, 1, 1),
                end_date=date(2023, 1, 1),
            )

    def test_defaults(self):
        dc = DeviceContext(device=DEVICE_MODELS[0])
        assert dc.start_date is not None
        assert dc.end_date is not None

    def test_only_start(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2020, 1, 1),
        )
        assert dc.end_date is not None

    def test_only_end(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            end_date=date(2024, 6, 1),
        )
        assert dc.start_date is not None

    def test_serialize_dt(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
        )
        data = dc.model_dump()
        assert isinstance(data["start_date"], str)

    def test_timezone_with_country(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
            country_info="United States",
        )
        assert dc.timezone is not None

    def test_timezone_no_country(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
        )
        assert dc.timezone is None

    def test_languages_with_country(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
            country_info="United States",
        )
        assert dc.languages is not None

    def test_languages_no_country(self):
        dc = DeviceContext(
            device=DEVICE_MODELS[0],
            start_date=date(2023, 1, 1),
            end_date=date(2024, 1, 1),
        )
        assert dc.languages is None


class TestCustomEvent:
    def test_create(self):
        from model.job import CustomEventFieldValue, ReportModelFieldType

        ce = CustomEvent(
            model_type="test_model",
            fields={
                "f1": CustomEventFieldValue(
                    value_type="str", field_type=ReportModelFieldType.FIELD, value="v1"
                )
            },
        )
        assert ce.model_type == "test_model"
