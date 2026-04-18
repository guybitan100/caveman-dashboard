import pytest

from model.tasks import CookieTask

from generation.simulation.events.contractors.cookies import CookieContractor


def test_construct_five_cookies(job: pytest.fixture, job_hub: pytest.fixture):
    cookies_count = 5
    task = CookieTask(quantity=cookies_count)
    cookies_contractor = CookieContractor(job=job, hub=job_hub, task=task)
    cookies = cookies_contractor.construct()
    assert len(list(cookies)) == 5
