from api.device_info import (
    generate_initial_device_info,
    generate_updated_device_info,
    DEVICE_OS_FIELD,
    DEVICE_MODEL_FIELD,
)
from model.device_models import DeviceModel
from model.job import DeviceContext
from model.types import DeviceInfoEntry
from datetime import date, timedelta


def _make_context(os="android", manufacturer="Samsung", name="Galaxy S21"):
    return DeviceContext(
        device=DeviceModel(manufacturer=manufacturer, name=name, os=os),
        start_date=date.today() - timedelta(days=365),
        end_date=date.today(),
    )


class TestGenerateInitialDeviceInfo:
    def test_returns_os_and_model(self):
        ctx = _make_context(os="android", manufacturer="Samsung", name="Galaxy S21")
        result = generate_initial_device_info(context=ctx)
        assert len(result) == 2
        os_entry = next(e for e in result if e.key == DEVICE_OS_FIELD)
        model_entry = next(e for e in result if e.key == DEVICE_MODEL_FIELD)
        assert os_entry.value == "android"
        assert model_entry.value == "Samsung Galaxy S21"

    def test_ios_device(self):
        ctx = _make_context(os="ios", manufacturer="iPhone", name="15 Pro")
        result = generate_initial_device_info(context=ctx)
        os_entry = next(e for e in result if e.key == DEVICE_OS_FIELD)
        assert os_entry.value == "ios"


class TestGenerateUpdatedDeviceInfo:
    def test_updates_existing_entries(self):
        old_ctx = _make_context(os="android", manufacturer="Samsung", name="Galaxy S21")
        old_info = generate_initial_device_info(context=old_ctx)
        new_ctx = _make_context(os="ios", manufacturer="iPhone", name="15 Pro")
        result = generate_updated_device_info(context=new_ctx, device_info=old_info)
        os_entry = next(e for e in result if e.key == DEVICE_OS_FIELD)
        assert os_entry.value == "ios"

    def test_preserves_extra_entries(self):
        old_ctx = _make_context()
        old_info = generate_initial_device_info(context=old_ctx)
        old_info.append(DeviceInfoEntry(key="CustomKey", value="CustomValue"))
        new_ctx = _make_context(os="ios", manufacturer="iPhone", name="15")
        result = generate_updated_device_info(context=new_ctx, device_info=old_info)
        assert len(result) == 3
        custom = next(e for e in result if e.key == "CustomKey")
        assert custom.value == "CustomValue"
