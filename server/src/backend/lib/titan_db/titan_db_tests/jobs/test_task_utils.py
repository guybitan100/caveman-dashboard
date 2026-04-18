from unittest.mock import patch, MagicMock, PropertyMock

import pytest
from pynamodb.exceptions import DoesNotExist, PutError

from model.status import GenerationTaskStatus
from titan_db.jobs.db_task_utils import (
    insert_task,
    insert_tasks,
    update_task,
    delete_task,
    update_generation_task_status,
    update_generation_task_final_count,
    get_generation_task,
    get_task_progress,
    _get_task_model,
    _update_task_model,
    _flatten_db_tasks_from_root_task,
)
from titan_db.jobs.errors import TaskNotFoundError


def _make_mock_task(task_id="t1", event_type="call", quantity=10):
    task = MagicMock()
    task.task_id = task_id
    task.event_type = event_type
    task.quantity = quantity
    task.get_sub_tasks.return_value = []
    task.model_dump.return_value = {
        "task_id": task_id,
        "event_type": event_type,
        "quantity": quantity,
    }
    return task


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
@patch("titan_db.jobs.db_task_utils.get_job_model")
class TestInsertTask:
    def test_insert_single_task(self, mock_get_job, mock_db_task_model):
        mock_job = MagicMock()
        mock_job.tasks = []
        mock_get_job.return_value = mock_job
        task = _make_mock_task(task_id="t1")
        insert_task(job_id="j1", task=task)
        mock_job.save.assert_called_once()
        assert len(mock_job.tasks) >= 1


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
@patch("titan_db.jobs.db_task_utils.get_job_model")
class TestInsertTasks:
    def test_insert_multiple_tasks(self, mock_get_job, mock_db_task_model):
        mock_job = MagicMock()
        mock_job.tasks = []
        mock_get_job.return_value = mock_job
        tasks = [_make_mock_task(task_id="t1"), _make_mock_task(task_id="t2")]
        insert_tasks(job_id="j1", tasks=tasks)
        mock_job.save.assert_called_once()
        assert len(mock_job.tasks) >= 2


@patch("titan_db.jobs.db_task_utils.insert_task")
@patch("titan_db.jobs.db_task_utils.delete_task")
class TestUpdateTask:
    def test_update_deletes_then_inserts(self, mock_delete, mock_insert):
        task = _make_mock_task()
        update_task(job_id="j1", task_id="t1", task=task)
        mock_delete.assert_called_once_with(job_id="j1", task_id="t1")
        mock_insert.assert_called_once_with(job_id="j1", task=task)


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
@patch("titan_db.jobs.db_task_utils.get_job_model")
class TestDeleteTask:
    def test_delete_task(self, mock_get_job, mock_db_task_model):
        mock_job = MagicMock()
        mock_task = MagicMock()
        mock_task.task_id = "t1"
        mock_job.tasks = [mock_task]
        mock_get_job.return_value = mock_job

        mock_batch = MagicMock()
        mock_batch.__enter__ = MagicMock(return_value=mock_batch)
        mock_batch.__exit__ = MagicMock(return_value=False)
        mock_db_task_model.batch_write.return_value = mock_batch
        mock_db_task_model.job_id_index.query.return_value = []

        delete_task(job_id="j1", task_id="t1")
        mock_job.save.assert_called_once()
        # Task should be filtered out
        assert all(t.task_id != "t1" for t in mock_job.tasks)


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
@patch("titan_db.jobs.db_task_utils.now")
class TestUpdateGenerationTaskStatus:
    def test_set_generating(self, mock_now, mock_model):
        mock_now.return_value = "2024-01-01T00:00:00"
        update_generation_task_status(
            task_id="t1", status=GenerationTaskStatus.Generating
        )
        mock_model.return_value.update.assert_called_once()

    def test_set_done(self, mock_now, mock_model):
        mock_now.return_value = "2024-01-01T00:00:00"
        update_generation_task_status(task_id="t1", status=GenerationTaskStatus.Done)
        mock_model.return_value.update.assert_called_once()

    def test_set_pending(self, mock_now, mock_model):
        update_generation_task_status(task_id="t1", status=GenerationTaskStatus.Pending)
        mock_model.return_value.update.assert_called_once()


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
class TestUpdateGenerationTaskFinalCount:
    def test_set_final_count(self, mock_model):
        update_generation_task_final_count(task_id="t1", count=42)
        mock_model.return_value.update.assert_called_once()


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
class TestGetGenerationTask:
    def test_get_existing(self, mock_model):
        mock_model.get.return_value = MagicMock(task_id="t1")
        result = get_generation_task(task_id="t1")
        assert result.task_id == "t1"


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
class TestGetTaskModel:
    def test_get_existing(self, mock_model):
        mock_model.get.return_value = MagicMock(task_id="t1")
        result = _get_task_model(task_id="t1")
        assert result.task_id == "t1"

    def test_not_found(self, mock_model):
        mock_model.get.side_effect = DoesNotExist()
        with pytest.raises(TaskNotFoundError):
            _get_task_model(task_id="missing")


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
class TestUpdateTaskModel:
    def test_update_success(self, mock_model):
        _update_task_model(task_id="t1", actions=[])

    def test_update_not_found(self, mock_model):
        mock_model.return_value.update.side_effect = PutError()
        with pytest.raises(TaskNotFoundError):
            _update_task_model(task_id="missing", actions=[])


@patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
class TestGetTaskProgress:
    def test_normal_progress(self, mock_model):
        mock_task = MagicMock()
        mock_task.status = GenerationTaskStatus.Generating
        mock_task.requested_count = 100
        mock_task.final_count = 50
        mock_model.get.return_value = mock_task
        status, progress = get_task_progress(task_id="t1")
        assert status == GenerationTaskStatus.Generating
        assert progress == 0.5

    def test_zero_requested_done(self, mock_model):
        mock_task = MagicMock()
        mock_task.status = GenerationTaskStatus.Done
        mock_task.requested_count = 0
        mock_task.final_count = 0
        mock_model.get.return_value = mock_task
        status, progress = get_task_progress(task_id="t1")
        assert progress == 1.0

    def test_zero_requested_not_done(self, mock_model):
        mock_task = MagicMock()
        mock_task.status = GenerationTaskStatus.Pending
        mock_task.requested_count = 0
        mock_task.final_count = 0
        mock_model.get.return_value = mock_task
        status, progress = get_task_progress(task_id="t1")
        assert progress == 0.0

    def test_no_final_count(self, mock_model):
        mock_task = MagicMock()
        mock_task.status = GenerationTaskStatus.Generating
        mock_task.requested_count = 100
        mock_task.final_count = None
        mock_model.get.return_value = mock_task
        status, progress = get_task_progress(task_id="t1")
        assert progress == 0.0


class TestFlattenDbTasks:
    @patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
    def test_root_only(self, mock_model):
        task = _make_mock_task(task_id="t1", quantity=10)
        result = list(_flatten_db_tasks_from_root_task(job_id="j1", task=task))
        assert len(result) >= 1

    @patch("titan_db.jobs.db_task_utils.DBGenerationTaskModel")
    def test_with_sub_tasks(self, mock_model):
        sub = _make_mock_task(task_id="sub1", quantity=5)
        sub.parent_task_id = None
        sub.root_task_id = None
        root = _make_mock_task(task_id="t1", quantity=10)
        root.get_sub_tasks.return_value = [sub]
        result = list(_flatten_db_tasks_from_root_task(job_id="j1", task=root))
        assert len(result) >= 2
