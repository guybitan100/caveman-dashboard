from datetime import datetime
from typing import Iterator

from model.tasks import InstalledAppTask
from model.types import EventType, InstalledApplication
from metafinder_core.models import AppModel
from metafinder_core.queries import ApplicationQueryParams
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times


@register_contractor(EventType.APP)
class InstalledAppContractor(EventContractor[InstalledAppTask, InstalledApplication]):
    def construct(self) -> Iterator[InstalledApplication]:
        app_metadatas = ApplicationQueryParams(os=self.job.context.device.os).query(count=self.quantity)
        times = random_times(n=self.quantity, job=self.job)
        apps = self._create_apps_from_metadatas(app_metadatas=app_metadatas, times=times)
        yield from apps

    def construct_by_ids(self, app_ids: list[str]) -> Iterator[InstalledApplication]:
        if not app_ids:
            return
        app_metadatas = ApplicationQueryParams(app_ids=app_ids).query()
        app_metadatas_ids = [a.app_id for a in app_metadatas]
        missing_app_ids = [app_id for app_id in app_ids if app_id not in app_metadatas_ids]

        app_metadatas.extend(self._generate_apps_from_ids(missing_app_ids))
        times = random_times(n=len(app_metadatas), job=self.job)
        apps = self._create_apps_from_metadatas(app_metadatas=app_metadatas, times=times)

        yield from apps

    @staticmethod
    def _generate_apps_from_ids(app_ids: list[str]) -> list[AppModel]:
        return [
            AppModel(
                app_id=app_id,
                name=app_id,
                os=''  # Leave it as an empty string as this is not relevant after MetaFinder query
            )
            for app_id in app_ids
        ]

    @staticmethod
    def _create_apps_from_metadatas(
            app_metadatas: Iterator[AppModel],
            times: Iterator[datetime]
    ) -> Iterator[InstalledApplication]:
        for app_metadata, time in zip(app_metadatas, times):
            yield InstalledApplication(
                app_id=app_metadata.app_id,
                name=app_metadata.name,
                category=app_metadata.category,
                event_types=app_metadata.event_types,
                time=time
            )
