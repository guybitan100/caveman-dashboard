import pytest
from pytest_mock import MockerFixture

from generation.simulation.social import LocationIdAllocation
from metafinder_core.models import UrlModel
from model.tasks import VisitedPageTask

from generation.simulation.events.contractors.web_history import WebHistoryContractor
from model.types import EventType


def test_construct_five_web_history(
        job: pytest.fixture,
        job_hub: pytest.fixture,
        mocker: MockerFixture,
        social_context: pytest.fixture
):
    web_history_count = 5
    task = VisitedPageTask(quantity=web_history_count)
    web_history_contractor = WebHistoryContractor(job=job, hub=job_hub, task=task)
    metafinder_client_mock = mocker.patch('metafinder_core.queries.MetaFinderQueryParams.query')
    metafinder_client_mock.return_value = [UrlModel(url='https://google.com', categories='News', cctld=None,
                                                       md5='')] * web_history_count
    social_context.location_allocations = {
        web_history_contractor.task.task_id: LocationIdAllocation(
            event_type=EventType.WEB_HISTORY,
            base_idx=0,
            num_locations=web_history_count,
            loc_task_id_to_range={}
        )
    }
    web_history = web_history_contractor.construct()
    assert len(list(web_history)) == 5
