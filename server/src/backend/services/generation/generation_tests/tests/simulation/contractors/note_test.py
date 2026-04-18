import pytest
from pytest_mock import MockerFixture

from metafinder_core.models import ChatModel
from model.tasks import NoteTask

from generation.simulation.events.contractors.note import NoteContractor


def metafinder_client_sentences_side_effect(count: int) -> list[ChatModel]:
    return [ChatModel(text='template string for testing', language='en', md5='')] * count


def test_construct_five_notes(job: pytest.fixture, job_hub: pytest.fixture, mocker: MockerFixture):
    metafinder_client_mock = mocker.patch('metafinder_core.queries.MetaFinderQueryParams.query')
    metafinder_client_mock.side_effect = metafinder_client_sentences_side_effect
    notes_count = 5
    task = NoteTask(quantity=notes_count)
    notes_contractor = NoteContractor(job=job, hub=job_hub, task=task)
    notes = notes_contractor.construct()
    assert len(list(notes)) == 5
