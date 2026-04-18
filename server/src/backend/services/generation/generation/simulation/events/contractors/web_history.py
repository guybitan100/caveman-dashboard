from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.urls import UrlGenerator
from model.tasks import VisitedPageTask
from model.types import WebHistory, EventType
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()
_url_generator = UrlGenerator()


@register_contractor(EventType.WEB_HISTORY)
class WebHistoryContractor(EventContractor[VisitedPageTask, WebHistory]):
    def construct(self) -> Iterator[WebHistory]:
        urls = _url_generator.generate(n=self.quantity, country_info=self.job.context.country_info,
                                       categories=self.task.categories)
        titles = self._repeat_func(self.quantity, _faker.text)
        visit_counts = self._random_range_choices(self.quantity,
                                                  self.task.min_visit_counts, self.task.max_visit_counts)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        histories = (
            WebHistory(
                url=url,
                title=title,
                uses=num_use,
                time=time,
                location_id=location_id
            )
            for url, title, num_use, time, location_id
            in zip(urls, titles, visit_counts, times, location_ids)
        )

        yield from histories
