from model.job import DeviceContext
from model.types import DeviceInfoEntry

DEVICE_OS_FIELD = "DeviceInfoOSType"
DEVICE_MODEL_FIELD = "DeviceInfoDetectedPhoneModel"


def generate_initial_device_info(context: DeviceContext) -> list[DeviceInfoEntry]:
    device_info = [
        DeviceInfoEntry(key=DEVICE_OS_FIELD, value=context.device.os),
        DeviceInfoEntry(key=DEVICE_MODEL_FIELD, value=f'{context.device.manufacturer} {context.device.name}'),
    ]
    return device_info


def generate_updated_device_info(context: DeviceContext, device_info: list[DeviceInfoEntry]) -> list[DeviceInfoEntry]:
    new_device_info = generate_initial_device_info(context=context)     # Generate new entries based on given context
    new_key_to_entry = {entry.key: entry for entry in new_device_info}
    # Replace existing entry with newly generated entry if exists or keep existing entry
    new_device_info = [
        new_key_to_entry.get(entry.key, entry)
        for entry in device_info
    ]
    return new_device_info
