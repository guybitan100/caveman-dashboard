import math
import random
from dataclasses import dataclass
from typing import Iterator

from simulation_utils.generator import DataGenerator


@dataclass
class GeneratedCoordinate:
    latitude: float
    longitude: float


class CoordinateGenerator(DataGenerator):
    def generate(
            self,
            n: int,
            base_latitude: float,
            base_longitude: float,
            radius: int
    ) -> Iterator[GeneratedCoordinate]:
        coordinates = (
            GeneratedCoordinate(latitude=base_latitude + lat_offset, longitude=base_longitude + long_offset)
            for lat_offset, long_offset in self._get_offsets(n=n, radius=radius)
        )

        yield from coordinates

    @staticmethod
    def _get_offsets(n: int, radius: int) -> tuple[float, float]:
        for _ in range(n):
            ang = 2 * math.pi * random.random()
            hyp = 0.01 * radius * math.sqrt(random.random())
            adj = math.cos(ang) * hyp
            opp = math.sin(ang) * hyp
            yield adj, opp

