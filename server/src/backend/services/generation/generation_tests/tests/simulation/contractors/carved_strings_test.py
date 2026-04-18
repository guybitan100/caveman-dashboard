import pytest
from pytest_mock import MockerFixture

import generation
from model.tasks import CarvedStringTask
from generation.simulation.events.contractors.carved_strings import CarvedStringContractor


def test_construct_five_carved_strings(job: pytest.fixture, job_hub: pytest.fixture,):
    carved_strings_count = 5
    task = CarvedStringTask(quantity=carved_strings_count)
    carved_strings_contractor = CarvedStringContractor(job=job, hub=job_hub, task=task)
    carved_strings = carved_strings_contractor.construct()
    assert len(list(carved_strings)) == 5


def test_construct_carved_string_body(job: pytest.fixture, job_hub: pytest.fixture, mocker: MockerFixture):
    carved_strings_count = 1
    task = CarvedStringTask(quantity=carved_strings_count)
    mock_faker = mocker.patch(
        f"{generation.simulation.events.contractors.carved_strings.__name__}._faker",
        wraps=generation.simulation.events.contractors.carved_strings._faker,
    )
    mock_faker.sentence.return_value = "qq"
    carved_strings_contractor = CarvedStringContractor(job=job, hub=job_hub, task=task)
    carved_strings = list(carved_strings_contractor.construct())
    assert carved_strings[0].body == "qq"
