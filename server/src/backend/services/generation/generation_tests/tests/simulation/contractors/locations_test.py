import pytest

from model.tasks import LocationTask

from generation.simulation.events.contractors.locations import LocationContractor


def test_construct_five_locations(job: pytest.fixture, job_hub: pytest.fixture):
    locations_count = 5
    task = LocationTask(quantity=locations_count)
    locations_contractor = LocationContractor(job=job, hub=job_hub, task=task)
    locations = locations_contractor.construct()
    assert len(list(locations)) == 5
