import pytest

from model.tasks import PasswordTask
from generation.simulation.events.contractors.passwords import PasswordContractor


def test_construct_five_passwords(job: pytest.fixture, job_hub: pytest.fixture):
    passwords_count = 5
    task = PasswordTask(quantity=passwords_count)
    passwords_contractor = PasswordContractor(job=job, hub=job_hub, task=task)
    passwords = passwords_contractor.construct()
    assert len(list(passwords)) == 5
