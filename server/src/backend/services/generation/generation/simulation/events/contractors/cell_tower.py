from typing import Iterator

from generation.simulation.utils import random_times
from model.tasks import CellTowerTask
from model.types import EventType, CellTower
from metafinder_core.queries import CellTowerQueryParams

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor


@register_contractor(EventType.CELL_TOWER)
class CellTowerContractor(EventContractor[CellTowerTask, CellTower]):
    def construct(self) -> Iterator[CellTower]:
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        if self.task.longitude and self.task.latitude:
            raw_ct_data = CellTowerQueryParams(lon=self.task.longitude, lat=self.task.latitude).query(count=self.quantity)
        elif self.job.context.country_info:
            raw_ct_data = CellTowerQueryParams(mcc=self.job.context.country_info.mcc).query(count=self.quantity)
        else:
            raw_ct_data = CellTowerQueryParams().query(count=self.quantity)

        cell_towers = (
            CellTower(
                lac=ct.area,
                lat=ct.location.lat,
                long=ct.location.lon,
                cid=ct.cell,
                mcc=ct.mcc,
                radio=ct.radio,
                mnc=ct.net,
                time=time,
                location_id=location_id
            )
            for ct, time, location_id in zip(raw_ct_data, times, location_ids)
        )

        yield from cell_towers
