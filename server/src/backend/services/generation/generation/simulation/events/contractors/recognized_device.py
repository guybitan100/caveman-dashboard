import random
from dataclasses import dataclass
from typing import Callable, Iterator

from faker import Faker

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.tasks import RecognizedDeviceTask
from model.types import EventType, RecognizedDevice
from model.utils import str_uuid

_faker = Faker()

IDENTIFIERS_PROB = 0.4
NAME_PROB = 0.3
SERIAL_NUMBER_PROB = 0.3


@dataclass(frozen=True)
class DeviceModel:
    type: str
    manufacturer: str
    series: str
    model: str

    def display_model(self) -> str:
        return f'{self.manufacturer} {self.series} {self.model}'

    def display_name(self, user_name: str) -> str:
        return f"{user_name}'s {self.series}"


PHONE_DEVICES = [
        DeviceModel(manufacturer='Xiaomi', series='12T', model='Pro', type='Phone'),
        DeviceModel(manufacturer='Xiaomi', series='12', model='', type='Phone'),
        DeviceModel(manufacturer='Poco', series='XG', model='GT', type='Phone'),
        DeviceModel(manufacturer='Google', series='Pixel', model='7 Pro', type='Phone'),
        DeviceModel(manufacturer='Google', series='Pixel', model='7', type='Phone'),
        DeviceModel(manufacturer='OnePlus', series='Nord', model='CE 2 Lite 5G', type='Phone'),
        DeviceModel(manufacturer='OnePlus', series='Nord', model='2T', type='Phone'),
        DeviceModel(manufacturer='OnePlus', series='10', model='Pro', type='Phone'),
        DeviceModel(manufacturer='Samsung', series='Galaxy', model='A33', type='Phone'),
        DeviceModel(manufacturer='Samsung', series='Galaxy', model='S21 FE', type='Phone'),
        DeviceModel(manufacturer='Apple', series='IPhone', model='13', type='Phone'),
        DeviceModel(manufacturer='Apple', series='IPhone', model='13 Pro', type='Phone'),
        DeviceModel(manufacturer='realme', series='9', model='Pro+', type='Phone'),
        DeviceModel(manufacturer='realme', series='GT Neo', model='3T', type='Phone'),
    ]

COMPUTER_DEVICES = [
        DeviceModel(manufacturer='Apple', series='MacBook', model='Air M2', type='Computer'),
        DeviceModel(manufacturer='Apple', series='MacBook', model='Air M1', type='Computer'),
        DeviceModel(manufacturer='Apple', series='MacBook', model='Pro M2', type='Computer'),
        DeviceModel(manufacturer='Apple', series='MacBook', model='Pro M1', type='Computer'),
        DeviceModel(manufacturer='Apple', series='Mac', model='Mini M2', type='Computer'),
        DeviceModel(manufacturer='Apple', series='Mac', model='Mini M1', type='Computer'),
        DeviceModel(manufacturer='Dell', series='XPS', model='13', type='Computer'),
        DeviceModel(manufacturer='HP', series='Pavvillon', model='Aero 13', type='Computer'),
        DeviceModel(manufacturer='Lenovo', series='Yoga', model='7i', type='Computer'),
        DeviceModel(manufacturer='Acer', series='Chromebook', model='M1', type='Computer'),
        DeviceModel(manufacturer='Dell', series='Inspiron', model='16 Plus', type='Computer'),
        DeviceModel(manufacturer='Microsoft', series='Surface', model='Pro 8', type='Computer'),
    ]

WATCH_DEVICES = [
        DeviceModel(manufacturer='Apple', series='Watch', model='8', type='Watch'),
        DeviceModel(manufacturer='Apple', series='Watch', model='Ultra', type='Watch'),
        DeviceModel(manufacturer='Apple', series='Watch', model='SE', type='Watch'),
        DeviceModel(manufacturer='Samsung', series='Galaxy Watch', model='5 Pro', type='Watch'),
        DeviceModel(manufacturer='Samsung', series='Galaxy Watch', model='5', type='Watch'),
        DeviceModel(manufacturer='Google', series='Pixel Watch', model='', type='Watch'),
        DeviceModel(manufacturer='Mobvoi', series='TicWatch', model='E2', type='Watch'),
        DeviceModel(manufacturer='Mobvoi', series='TicWatch', model='Pro 3', type='Watch'),
        DeviceModel(manufacturer='FitBit', series='Versa', model='3', type='Watch'),
        DeviceModel(manufacturer='FitBit', series='Sense', model='', type='Watch'),
        DeviceModel(manufacturer='Garmin', series='Vivoactive', model='4', type='Watch'),
        DeviceModel(manufacturer='Garmin', series='Venu', model='2', type='Watch'),
        DeviceModel(manufacturer='Garmin', series='Lily', model='', type='Watch'),
    ]

DEVICES = PHONE_DEVICES + WATCH_DEVICES + COMPUTER_DEVICES


@dataclass(frozen=True)
class DeviceIdentifier:
    key: str
    get_value: Callable

    def get_key_value(self) -> tuple[str, str]:
        return self.key, self.get_value()


IDENTIFIERS = [
    DeviceIdentifier(key='MAC Address', get_value=_faker.mac_address),
    DeviceIdentifier(key='IP Address', get_value=_faker.ipv4),
    DeviceIdentifier(key='User ID', get_value=lambda: str_uuid()),
]


@register_contractor(EventType.RECOGNIZED_DEVICE)
class RecognizedDeviceContractor(EventContractor[RecognizedDeviceTask, RecognizedDevice]):
    def construct(self) -> Iterator[RecognizedDevice]:
        devices = self._random_choices(self.quantity, DEVICES)
        name_mask = self._random_boolean_choices(self.quantity, true_prob=NAME_PROB)
        serial_number_mask = self._random_boolean_choices(self.quantity, true_prob=SERIAL_NUMBER_PROB)
        identifiers_mask = self._random_range_choices(self.quantity, 1, len(IDENTIFIERS), none_weight=IDENTIFIERS_PROB)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        owner_name = self.context.owner_entity.first_name

        recognized_devices = (
            RecognizedDevice(
                type=device.type,
                model=device.display_model(),
                name=device.display_name(user_name=owner_name) if has_name else None,
                identifiers=self._get_identifiers(n=num_identifiers),
                serial_number=str_uuid() if has_serial_number else None,
                location_id=location_id
            )
            for device, num_identifiers, has_name, has_serial_number, time, location_id
            in zip(devices, identifiers_mask, name_mask, serial_number_mask, times, location_ids)
        )

        yield from recognized_devices

    @staticmethod
    def _get_identifiers(n: int) -> list[tuple[str, str]] | None:
        if not n:
            return None
        random_identifiers = random.sample(IDENTIFIERS, k=n)
        identifiers = [(idn.key, idn.get_value()) for idn in random_identifiers]
        return identifiers
