from unittest.mock import patch, MagicMock

import pytest

from api.draft import (
    create_job,
    verify_job_is_draft,
    update_job_name,
    update_device_context,
    update_device_info,
    update_owner_entity,
    create_random_events,
    create_task,
    update_task,
    delete_task,
    create_story,
    create_stories,
    update_story,
    delete_story,
    create_custom_event,
    update_custom_event,
    delete_custom_event,
    create_entity,
    create_entities,
    update_entity,
    delete_entity,
    RandomEventsRequest,
)
from model.status import JobStatus, ValidationStatus


MOCK_JOB = MagicMock()


@patch("api.draft.db_job_utils")
@patch("api.draft.generate_entity")
@patch("api.draft.generate_initial_device_info")
class TestCreateJob:
    def test_creates_with_random_name(self, mock_dev_info, mock_gen_entity, mock_db):
        mock_db.insert_job.return_value = "j1"
        mock_db.build_generation_job.return_value = MOCK_JOB
        mock_gen_entity.return_value = MagicMock()
        mock_dev_info.return_value = []
        request = MagicMock()
        request.name = None
        request.user = "test_user"
        result = create_job(request)
        mock_db.insert_job.assert_called_once()
        mock_db.build_generation_job.assert_called_once_with(job_id="j1")
        assert result is MOCK_JOB

    def test_creates_with_given_name(self, mock_dev_info, mock_gen_entity, mock_db):
        mock_db.insert_job.return_value = "j2"
        mock_db.build_generation_job.return_value = MOCK_JOB
        mock_gen_entity.return_value = MagicMock()
        mock_dev_info.return_value = []
        request = MagicMock()
        request.name = "MyJob"
        request.user = "u1"
        result = create_job(request)
        assert result is MOCK_JOB


@patch("api.draft.db_job_utils")
class TestVerifyJobIsDraft:
    def test_allows_draft(self, mock_db):
        mock_db.get_job_status.return_value = JobStatus.Draft

        @verify_job_is_draft
        def dummy_route(job_id):
            return "ok"

        result = dummy_route("j1")
        assert result == "ok"

    def test_rejects_non_draft(self, mock_db):
        mock_db.get_job_status.return_value = JobStatus.Done

        @verify_job_is_draft
        def dummy_route(job_id):
            return "ok"

        with pytest.raises(Exception, match="not a draft"):
            dummy_route("j1")


@patch("api.draft.db_job_utils")
class TestUpdateJobName:
    def test_updates_and_returns_job(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_job_name(job_id="j1", name="NewName")
        mock_db.update_job_name.assert_called_once_with(job_id="j1", name="NewName")
        assert result is MOCK_JOB


@patch("api.draft.db_job_utils")
@patch("api.draft.generate_updated_device_info")
class TestUpdateDeviceContext:
    def test_updates(self, mock_gen_info, mock_db):
        mock_db.get_device_info.return_value = []
        mock_db.build_generation_job.return_value = MOCK_JOB
        mock_gen_info.return_value = []
        ctx = MagicMock()
        result = update_device_context(job_id="j1", device_context=ctx)
        mock_db.update_device_context_and_info.assert_called_once()
        assert result is MOCK_JOB


@patch("api.draft.db_job_utils")
class TestUpdateDeviceInfo:
    def test_updates(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_device_info(job_id="j1", device_info=[])
        mock_db.update_device_info.assert_called_once()
        assert result is MOCK_JOB


@patch("api.draft.db_job_utils")
class TestUpdateOwnerEntity:
    def test_updates(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_owner_entity(job_id="j1", entity=MagicMock())
        mock_db.update_owner_entity.assert_called_once()
        assert result is MOCK_JOB


class TestRandomEventsRequest:
    def test_valid(self):
        req = RandomEventsRequest(total_events=100)
        assert req.total_events == 100

    def test_with_weights(self):
        req = RandomEventsRequest(
            total_events=10, event_weights={"call": 0.5, "sms": 0.5}
        )
        assert req.total_events == 10

    def test_zero_sum_weights_rejected(self):
        with pytest.raises(Exception):
            RandomEventsRequest(
                total_events=10, event_weights={"call": 0.0, "sms": 0.0}
            )


@patch("api.draft.db_job_utils")
@patch("api.draft.db_task_utils")
class TestCreateRandomEvents:
    def test_creates_tasks(self, mock_task_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_random_events(job_id="j1", total_events=100, event_weights=None)
        mock_task_utils.insert_tasks.assert_called_once()
        assert result is MOCK_JOB

    def test_with_custom_weights(self, mock_task_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        weights = {"call": 0.7, "sms": 0.3}
        result = create_random_events(
            job_id="j1", total_events=50, event_weights=weights
        )
        mock_task_utils.insert_tasks.assert_called_once()


@patch("api.draft.db_job_utils")
@patch("api.draft.db_task_utils")
@patch("api.draft.validate_task")
class TestCreateTask:
    def test_valid_task(self, mock_validate, mock_task_utils, mock_db):
        mock_validate.return_value = MagicMock(status=ValidationStatus.Success)
        mock_db.build_generation_job.return_value = MOCK_JOB
        task = MagicMock()
        result = create_task(job_id="j1", task=task, metafinder_client=MagicMock())
        mock_task_utils.insert_task.assert_called_once()

    def test_invalid_task(self, mock_validate, mock_task_utils, mock_db):
        validation = MagicMock(status=ValidationStatus.Failure)
        mock_validate.return_value = validation
        task = MagicMock()
        result = create_task(job_id="j1", task=task, metafinder_client=MagicMock())
        mock_task_utils.insert_task.assert_not_called()


@patch("api.draft.db_job_utils")
@patch("api.draft.db_task_utils")
@patch("api.draft.validate_task")
class TestUpdateTaskDraft:
    def test_valid(self, mock_validate, mock_task_utils, mock_db):
        mock_validate.return_value = MagicMock(status=ValidationStatus.Success)
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_task(
            job_id="j1", task_id="t1", task=MagicMock(), metafinder_client=MagicMock()
        )
        mock_task_utils.update_task.assert_called_once()

    def test_invalid(self, mock_validate, mock_task_utils, mock_db):
        mock_validate.return_value = MagicMock(status=ValidationStatus.Failure)
        result = update_task(
            job_id="j1", task_id="t1", task=MagicMock(), metafinder_client=MagicMock()
        )
        mock_task_utils.update_task.assert_not_called()


@patch("api.draft.db_job_utils")
@patch("api.draft.db_task_utils")
class TestDeleteTaskDraft:
    def test_deletes(self, mock_task_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = delete_task(job_id="j1", task_id="t1")
        mock_task_utils.delete_task.assert_called_once()
        assert result is MOCK_JOB


@patch("api.draft.db_job_utils")
@patch("api.draft.db_story_utils")
class TestStoryOperations:
    def test_create_story(self, mock_story_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_story(job_id="j1", story=MagicMock())
        mock_story_utils.insert_story.assert_called_once()
        assert result is MOCK_JOB

    def test_create_stories(self, mock_story_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_stories(job_id="j1", stories=[MagicMock()])
        mock_story_utils.insert_stories.assert_called_once()

    def test_update_story(self, mock_story_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_story(job_id="j1", story_id="s1", story=MagicMock())
        mock_story_utils.update_story.assert_called_once()

    def test_delete_story(self, mock_story_utils, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = delete_story(job_id="j1", story_id="s1")
        mock_story_utils.delete_story.assert_called_once()


@patch("api.draft.db_job_utils")
class TestCustomEventOperations:
    def test_create(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_custom_event(job_id="j1", custom_event=MagicMock())
        mock_db.insert_custom_event.assert_called_once()

    def test_update(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_custom_event(
            job_id="j1", event_id="e1", custom_event=MagicMock()
        )
        mock_db.update_custom_event.assert_called_once()

    def test_delete(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = delete_custom_event(job_id="j1", event_id="e1")
        mock_db.delete_custom_event.assert_called_once()


@patch("api.draft.db_job_utils")
class TestEntityOperations:
    def test_create_single(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_entity(job_id="j1", entity=MagicMock())
        mock_db.insert_entities.assert_called_once()

    def test_create_multiple(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = create_entities(job_id="j1", entities=[MagicMock(), MagicMock()])
        mock_db.insert_entities.assert_called_once()

    def test_update(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = update_entity(job_id="j1", entity_id="e1", entity=MagicMock())
        mock_db.update_entity.assert_called_once()

    def test_delete(self, mock_db):
        mock_db.build_generation_job.return_value = MOCK_JOB
        result = delete_entity(job_id="j1", entity_id="e1")
        mock_db.delete_entity.assert_called_once()
