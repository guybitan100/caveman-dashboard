import datetime

import pytest
from pytest_mock import MockerFixture

from model.tasks import JourneyTask
from model.types import Location

from generation.simulation.events.contractors.journey import JourneyContractor

locations = [
    Location(
        uid="89fba52a-eda5-4bd3-8fa4-c88a6ebadd12",
        app_uid=None,
        time=datetime.datetime(2021, 3, 22, 16, 12, 1),
        latitude=40.04273238315043,
        longitude=34.31110474407931,
        category='Journey'
    ),
    Location(
        uid="59aca5a8-235f-46a8-ab40-88c21735d292",
        app_uid=None,
        time=datetime.datetime(2022, 1, 3, 10, 57, 2),
        latitude=40.258793019161224,
        longitude=34.418073414854994,
        category='Journey'
    ),
]


def test_construct_five_journeys(job_hub: pytest.fixture, mocker: MockerFixture):
    read_events_mock = mocker.patch('six_db.events.db.read_events')
    read_events_mock.return_value = []
    journeys_count = 5
    task = JourneyTask(quantity=journeys_count)
    location_contractor_mock = mocker.patch(
        "generation.simulation.events.contractors.locations.LocationContractor.construct"
    )
    location_contractor_mock.return_value = locations
    journeys_contractor = JourneyContractor(hub=job_hub, task=task)
    journeys = journeys_contractor.construct()
    assert len(list(journeys)) == journeys_count
