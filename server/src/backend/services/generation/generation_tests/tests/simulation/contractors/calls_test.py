import pytest

from model.tasks import CallTask
from model.types import Entity

from generation.simulation.events.blueprints import PhoneCallBlueprint
from generation.simulation.events.contractors.calls import CallContractor

blueprints = [
    PhoneCallBlueprint(
        participant=Entity(
            uid="82742f95-6c9a-499d-ae29-3619ff8d7429",
            phone="935-676-6597x33935",
            first_name="Sara",
            last_name="Mitchell",
            email="james44@hotmail.com",
        )
    ),
    PhoneCallBlueprint(
        participant=Entity(
            uid="3d2efda8-966a-499c-a132-4bd8a258367d",
            phone="113.445.6915x79226",
            first_name="Doris",
            last_name="Garcia",
            email="ashley64@hotmail.com",
        )
    ),
    PhoneCallBlueprint(
        participant=Entity(
            uid="82742f95-6c9a-499d-ae29-3619ff8d7429",
            phone="935-676-6597x33935",
            first_name="Sara",
            last_name="Mitchell",
            email="james44@hotmail.com",
        )
    ),
    PhoneCallBlueprint(
        participant=Entity(
            uid="82742f95-6c9a-499d-ae29-3619ff8d7429",
            phone="935-676-6597x33935",
            first_name="Sara",
            last_name="Mitchell",
            email="james44@hotmail.com",
        )
    ),
    PhoneCallBlueprint(
        participant=Entity(
            uid="82742f95-6c9a-499d-ae29-3619ff8d7429",
            phone="935-676-6597x33935",
            first_name="Sara",
            last_name="Mitchell",
            email="james44@hotmail.com",
        )
    ),
]


def test_construct_five_calls(job: pytest.fixture, job_hub: pytest.fixture):
    task = CallTask(quantity=len(blueprints))
    calls_contractor = CallContractor(job=job, hub=job_hub, task=task)
    calls = list(calls_contractor.construct(blueprints=blueprints))
    assert len(calls) == 5
    assert calls[2].participant == blueprints[2].participant.uid
