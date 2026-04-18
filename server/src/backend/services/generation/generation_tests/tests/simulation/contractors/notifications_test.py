import pytest

from model.tasks import NotificationTask

from generation.simulation.events.contractors.notifications import NotificationContractor


def test_construct_five_notifications(job: pytest.fixture, job_hub: pytest.fixture):
    notifications_count = 5
    task = NotificationTask(quantity=notifications_count)
    notifications_contractor = NotificationContractor(job=job, hub=job_hub, task=task)
    notifications = notifications_contractor.construct()
    assert len(list(notifications)) == 5
