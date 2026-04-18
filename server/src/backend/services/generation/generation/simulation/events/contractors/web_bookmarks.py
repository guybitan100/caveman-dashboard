from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.urls import UrlGenerator
from model.tasks import WebBookmarkTask
from model.types import WebBookmark, EventType

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()
_url_generator = UrlGenerator()


@register_contractor(EventType.WEB_BOOKMARK)
class WebBookmarkContractor(EventContractor[WebBookmarkTask, WebBookmark]):
    def construct(self) -> Iterator[WebBookmark]:
        urls = _url_generator.generate(n=self.quantity, country_info=self.job.context.country_info,
                                       categories=self.task.categories)
        titles = self._repeat_func(self.quantity, _faker.text)
        visit_counts = self._random_range_choices(self.quantity,
                                                  self.task.min_visit_counts, self.task.max_visit_counts)
        n_folder_names = self._random_range_choices(self.quantity,
                                                    self.task.min_folder_dirs, self.task.max_folder_dirs)
        folders = ("/".join(self._repeat_func(k, _faker.word)) for k in n_folder_names)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        bookmarks = (
            WebBookmark(
                url=url,
                title=title,
                uses=num_use,
                folder=folder,
                time=time,
                location_id=location_id
            )
            for url, title, num_use, folder, time, location_id
            in zip(urls, titles, visit_counts, folders, times, location_ids)
        )

        yield from bookmarks
