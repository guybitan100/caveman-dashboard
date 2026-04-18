from datetime import datetime
from itertools import repeat
from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.coordinates import CoordinateGenerator
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from model.tasks import JourneyTask
from model.types import Journey, EventType
from generation.simulation.utils import random_times

_faker = Faker()


@register_contractor(EventType.JOURNEY)
class JourneyContractor(EventContractor[JourneyTask, Journey]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._coordinate_generator = CoordinateGenerator()  #TODO pass country info as arg

    def construct(self) -> Iterator[Journey]:
        start_time = self.task.start_time or datetime.fromordinal(self.job.context.start_date.toordinal())
        end_time = self.task.end_time or datetime.fromordinal(self.job.context.end_date.toordinal())
        start_end_times = repeat((start_time, end_time), times=self.quantity)

        times = random_times(n=self.quantity, job=self.job)

        # Generate double coordinates (because each Journey has start and finish locations)
        base_latitude, base_longitude = map(float, _faker.location_on_land(coords_only=True))  # TODO use local_latlng with country code if selected
        coordinates = self._coordinate_generator.generate(
            n=2*self.quantity,
            base_latitude=base_latitude,
            base_longitude=base_longitude,
            radius=self.task.radius)
        start_end_coords = ((start_coord, next(coordinates)) for start_coord in coordinates)

        journeys = (
            Journey(
                start_time=start_time,
                end_time=end_time,
                time=time,
                from_lat=start_coord.latitude,
                from_long=start_coord.longitude,
                to_lat=end_coord.latitude,
                to_long=end_coord.longitude
            )
            for (start_coord, end_coord), (start_time, end_time), time
            in zip(start_end_coords, start_end_times, times)
        )

        yield from journeys
