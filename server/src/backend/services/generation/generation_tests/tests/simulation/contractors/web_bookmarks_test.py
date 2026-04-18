import pytest
from pytest_mock import MockerFixture

from metafinder_core.models import UrlModel
from model.tasks import WebBookmarkTask

from generation.simulation.events.contractors.web_bookmarks import WebBookmarkContractor


def test_construct_five_web_bookmarks(job: pytest.fixture, job_hub: pytest.fixture, mocker: MockerFixture):
    web_bookmarks_count = 5
    task = WebBookmarkTask(quantity=web_bookmarks_count)
    web_bookmarks_contractor = WebBookmarkContractor(job=job, hub=job_hub, task=task)
    metafinder_client_mock = mocker.patch('metafinder_core.queries.MetaFinderQueryParams.query')
    metafinder_client_mock.return_value = [UrlModel(url='https://google.com', categories='News', cctld=None, md5='')] * web_bookmarks_count
    web_bookmarks = web_bookmarks_contractor.construct()
    assert len(list(web_bookmarks)) == 5
