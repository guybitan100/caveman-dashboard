from typing import Iterator
import random
import itertools
from itertools import repeat

from faker import Faker

from core.config import SETTINGS
from model.tasks import LocationTask
from model.types import Location, EventType, Image
from model.utils import str_uuid
from generation.simulation.data.generators.coordinates import CoordinateGenerator, GeneratedCoordinate
from generation.simulation.data.generators.location_thumbnails import LocationThumbnailsGenerator, LocationThumbnailParam
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()
_event_type_categories = {
    EventType.CONTACT: ['Unknown', EventType.CONTACT.value],
    EventType.CELL_TOWER: ['CellTower', 'External'],
    EventType.VIDEO: ['Metadata', 'Media Locations'],
    EventType.AUDIO: ['Metadata', 'Media Locations'],
    EventType.IMAGE: ['Metadata', 'Media Locations'],
    EventType.DOCUMENT: ['Metadata', 'Media Locations'],
    EventType.ARCHIVE: ['Metadata', 'Media Locations'],
    EventType.INSTANT_MESSAGE: ['External', 'Unknown', 'Events'],
    EventType.CHAT: ['External', 'Unknown', 'Events'],
    EventType.CALENDAR_ENTRY: ['Mentioned'],
    EventType.CALL: ['Unknown', 'Call'],
    EventType.COOKIE: ['Unknown', 'Cookie'],
    EventType.EMAIL: ['Unknown', 'Mail Content', 'Email'],
    EventType.RECOGNIZED_DEVICE: ['Unknown', 'Recognized Device'],
    EventType.USER_ACCOUNT: ['Unknown', 'User Account'],
    EventType.WEB_BOOKMARK: ['Unknown', 'Web Bookmark'],
    EventType.WEB_HISTORY: ['Unknown', 'Visited Page'],
    EventType.POWERING_EVENT: ['Unknown', 'Powering Event'],
    EventType.CREDIT_CARD: ['Unknown', 'Credit Card'],
    EventType.NOTE: ['Unknown', 'Note'],
    EventType.CARVED_STRING: ['Unknown', 'Carved String'],
    EventType.JOURNEY: ['Unknown', 'Journey'],
    EventType.NOTIFICATION: ['Unknown', 'Notification'],
    EventType.PASSWORD: ['Unknown', 'Password'],
    EventType.APP: ['Unknown', 'Installed Application']
}


@register_contractor(EventType.LOCATION)
class LocationContractor(EventContractor[LocationTask, Location]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._coordinate_generator = CoordinateGenerator()
        self._thumbnail_generator = LocationThumbnailsGenerator()

    def construct(self) -> Iterator[Location]:
        base_latitude, base_longitude = self.task.latitude, self.task.longitude
        if self.task.latitude is None or self.task.longitude is None:
            lat, long = _faker.location_on_land(coords_only=True)  # TODO use local_latlng with country code if selected
            base_latitude = float(lat) if self.task.latitude is None else self.task.latitude
            base_longitude = float(long) if self.task.longitude is None else self.task.longitude

        if self.task.category:
            categories = repeat(self.task.category, times=self.quantity)
            location_ids = self._repeat_func(self.quantity, str_uuid)
        else:
            location_ids, categories = zip(*self._get_location_ids_and_categories())

        times = random_times(n=self.quantity, job=self.job)

        coordinates = self._coordinate_generator.generate(
            n=self.quantity,
            base_latitude=base_latitude,
            base_longitude=base_longitude,
            radius=self.task.radius)

        if self.task.is_sub_task:
            coordinates = list(coordinates)     # allow memory usage; assumption: sub-task quantity will be low
            thumbnails = self._get_thumbnail_images(coordinates=coordinates)
            self.hub.save_events(events=thumbnails)
        else:
            thumbnails = repeat(None, times=self.quantity)

        locations = (
            Location(
                uid=location_id,
                latitude=coordinate.latitude,
                longitude=coordinate.longitude,
                time=time,
                thumbnail=thumbnail,
                category=category
            )
            for coordinate, thumbnail, time, category, location_id
            in zip(coordinates, thumbnails, times, categories, location_ids)
        )

        yield from locations

    def _get_location_ids_and_categories(self) -> Iterator[tuple[str, str]]:
        total_allocated_locations = 0   # Total events this Location task was meant to construct

        # Find and generate locations allocated across other non-location tasks
        location_allocations = self.context.location_allocations.values()
        for location_allocation in location_allocations:
            if self.task.task_id not in location_allocation.loc_task_id_to_range:
                continue    # this Location task was not assigned events to construct for this task's LocationAllocation
            # For each event, randomly choose a category or default to "Unknown"
            start_idx, end_idx = location_allocation.loc_task_id_to_range[self.task.task_id]
            location_ids = location_allocation[start_idx:end_idx]   # IDs this task will construct
            category_options = _event_type_categories.get(location_allocation.event_type)
            if category_options is not None:
                categories = random.choices(category_options, k=end_idx-start_idx)
            else:
                categories = itertools.repeat('Unknown', times=end_idx-start_idx)
            yield from zip(location_ids, categories)
            total_allocated_locations += end_idx - start_idx

        # Generate remaining locations with new ID and "Unknown" category
        remaining_locations = self.quantity - total_allocated_locations
        for _ in range(remaining_locations):
            yield str_uuid(), 'Unknown'

    def _get_thumbnail_images(self, coordinates: list[GeneratedCoordinate]) -> list[Image]:
        thumbnail_params = [
            LocationThumbnailParam(latitude=coordinate.latitude, longitude=coordinate.longitude)
            for coordinate in coordinates
        ]
        thumbnails_data = self._thumbnail_generator.generate(
            job_id=self.job.job_id, location_data=thumbnail_params)
        thumbnails = [
            Image(s3_key=thumbnail.path, size=thumbnail.size, md5=thumbnail.md5, format='png',
                  s3_bucket=SETTINGS.S3_TITAN_BUCKET_NAME, is_sub_event=True, deleted_state='Intact')
            for thumbnail in thumbnails_data
        ]
        return thumbnails
