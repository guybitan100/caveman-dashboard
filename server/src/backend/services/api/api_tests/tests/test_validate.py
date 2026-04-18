import pytest
from pytest_mock import MockerFixture
from unittest.mock import patch

from api.validator import validate_task
from metafinder_client.client import MetaFinderClient
from model.metafinder.data_types import DataType
from model.tasks import ChatTask, ValidationResult, GenerationTask
from model.status import ValidationStatus


def mock_init(*args, **kwargs):
    pass


@pytest.fixture
def metafinder_client() -> MetaFinderClient:
    with patch(
            "core.s3_client.TitanS3Client.__init__",
            new=mock_init,
    ):
        yield MetaFinderClient()


@pytest.fixture
def task():
    return ChatTask(
        quantity=100
    )


@pytest.fixture
def task_not_in_metafinder():
    return ChatTask(
        quantity=1000
    )


def test_validate(mocker: MockerFixture, task: GenerationTask, metafinder_client: MetaFinderClient):
    metafinder_get_count_patch = mocker.patch('metafinder_client.client.MetaFinderClient.get_count')
    metafinder_get_count_patch.return_value = 100

    expected = ValidationResult(status=ValidationStatus.Success, count=100)
    actual = validate_task(task, metafinder_client)

    assert expected.status == actual.status
    assert expected.count == actual.count

    metafinder_get_count_patch.assert_called_once_with(data_type=DataType.Chat, **task.model_dump())


def test_validate_partial_success(mocker: MockerFixture, task: GenerationTask, metafinder_client: MetaFinderClient):
    metafinder_get_count_patch = mocker.patch('metafinder_client.client.MetaFinderClient.get_count')
    metafinder_get_count_patch.return_value = 50

    expected = ValidationResult(status=ValidationStatus.PartialSucces, count=50)
    actual = validate_task(task, metafinder_client)

    assert expected.status == actual.status
    assert expected.count == actual.count

    metafinder_get_count_patch.assert_called_once_with(data_type=DataType.Chat, **task.model_dump())


def test_validate_failure(mocker: MockerFixture, task: GenerationTask, metafinder_client: MetaFinderClient):
    metafinder_get_count_patch = mocker.patch('metafinder_client.client.MetaFinderClient.get_count')
    metafinder_get_count_patch.return_value = 0

    expected = ValidationResult(status=ValidationStatus.Failure, count=0)
    actual = validate_task(task, metafinder_client)

    assert expected.status == actual.status
    assert expected.count == actual.count

    metafinder_get_count_patch.assert_called_once_with(data_type=DataType.Chat, **task.model_dump())


def test_validate_unmapped_task_should_return_success(mocker: MockerFixture, task_not_in_metafinder: GenerationTask,
                                                      metafinder_client: MetaFinderClient):
    # Mock map_event_to_metafinder_type to raise ValueError, simulating an unmapped task type
    mocker.patch('api.validator.map_event_to_metafinder_type', side_effect=ValueError('Unmapped event type'))
    
    expected = ValidationResult(status=ValidationStatus.Success, count=1000)
    actual = validate_task(task_not_in_metafinder, metafinder_client)

    assert expected.status == actual.status
    assert expected.count == actual.count
