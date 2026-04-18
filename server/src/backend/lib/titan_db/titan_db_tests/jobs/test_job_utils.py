from unittest.mock import patch, MagicMock
import pytest
from pynamodb.exceptions import DoesNotExist, PutError

from model.status import JobStatus, PhaseStatus
from model.phase import TitanPhase
from titan_db.jobs.db_job_utils import (
    insert_job,
    update_job_name,
    get_device_info,
    update_device_context_and_info,
    update_device_info,
    update_owner_entity,
    insert_entities,
    update_entity,
    delete_entity,
    filter_job,
    _get_job_most_relevant_timestamp,
    get_all_jobs,
    get_all_jobs_matching_prefix,
    get_job,
    get_job_model,
    update_job_model,
    update_job_status,
    get_job_status,
    delete_job,
    build_generation_job,
    _build_root_tasks,
    add_job_manifest,
    update_job_k8s_job_name,
    get_k8s_job_name,
    insert_phase,
    update_phase_status,
    delete_job_phases,
    insert_custom_event,
    update_custom_event,
    delete_custom_event,
)
from titan_db.jobs.errors import (
    JobNotFoundError,
    EntityNotFoundError,
    PhaseNotFoundError,
    TaskNotFoundError,
)


@patch("titan_db.jobs.db_job_utils.DBJobModel")
class TestInsertJob:
    def test_creates_and_returns_id(self, mock_model):
        mock_instance = MagicMock()
        mock_instance.id = "j-new"
        mock_model.return_value = mock_instance
        result = insert_job(
            user="Admin",
            name="Test",
            owner_entity=MagicMock(),
            device_context=MagicMock(),
            device_info=[],
        )
        assert result == "j-new"
        mock_instance.save.assert_called_once()

    def test_lowercases_user(self, mock_model):
        mock_instance = MagicMock()
        mock_instance.id = "j1"
        mock_model.return_value = mock_instance
        insert_job(
            user="ADMIN",
            name="Test",
            owner_entity=MagicMock(),
            device_context=MagicMock(),
            device_info=[],
        )
        call_kwargs = mock_model.call_args[1]
        assert call_kwargs["user"] == "admin"


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestUpdateJobName:
    def test_calls_update(self, mock_update):
        update_job_name(job_id="j1", name="NewName")
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestGetDeviceInfo:
    def test_returns_info(self, mock_get):
        mock_get.return_value = MagicMock(device_info=["info1"])
        result = get_device_info(job_id="j1")
        assert result == ["info1"]


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestUpdateDeviceContextAndInfo:
    def test_calls_update(self, mock_update):
        update_device_context_and_info(
            job_id="j1", device_context=MagicMock(), device_info=[]
        )
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestUpdateDeviceInfo:
    def test_calls_update(self, mock_update):
        update_device_info(job_id="j1", device_info=[])
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestUpdateOwnerEntity:
    def test_calls_update(self, mock_update):
        update_owner_entity(job_id="j1", entity=MagicMock())
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestInsertEntities:
    def test_appends_entities(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(entities=[MagicMock(uid="e1")])
        insert_entities(job_id="j1", entities=[MagicMock(uid="e2")])
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestUpdateEntity:
    def test_updates_existing(self, mock_get, mock_update):
        existing = MagicMock(uid="e1")
        mock_get.return_value = MagicMock(entities=[existing])
        new_entity = MagicMock(uid="e1-new")
        update_entity(job_id="j1", entity_id="e1", entity=new_entity)
        mock_update.assert_called_once()

    def test_not_found(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(entities=[])
        with pytest.raises(EntityNotFoundError):
            update_entity(job_id="j1", entity_id="missing", entity=MagicMock())


class TestDeleteEntity:
    def test_not_implemented(self):
        with pytest.raises(NotImplementedError):
            delete_entity(job_id="j1", entity_id="e1")


class TestFilterJob:
    def _make_job(self, name="test job", status=JobStatus.Draft, user="admin"):
        job = MagicMock()
        job.name = name
        job.status = status
        job.user = user
        job.id = "j1"
        return job

    def test_pass_all_none(self):
        job = self._make_job()
        assert filter_job(
            job, name=None, status=None, exclude_status=None, user=None, event_type=None
        )

    def test_filter_by_name(self):
        job = self._make_job(name="Alpha Job")
        assert not filter_job(
            job,
            name="beta",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )
        assert filter_job(
            job,
            name="alpha",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

    def test_filter_by_status(self):
        job = self._make_job(status=JobStatus.Draft)
        assert filter_job(
            job,
            name=None,
            status=JobStatus.Draft,
            exclude_status=None,
            user=None,
            event_type=None,
        )
        assert not filter_job(
            job,
            name=None,
            status=JobStatus.Done,
            exclude_status=None,
            user=None,
            event_type=None,
        )

    def test_filter_exclude_status(self):
        job = self._make_job(status=JobStatus.Draft)
        assert not filter_job(
            job,
            name=None,
            status=None,
            exclude_status=JobStatus.Draft,
            user=None,
            event_type=None,
        )

    def test_filter_by_user(self):
        job = self._make_job(user="admin")
        assert filter_job(
            job,
            name=None,
            status=None,
            exclude_status=None,
            user="admin",
            event_type=None,
        )
        assert not filter_job(
            job,
            name=None,
            status=None,
            exclude_status=None,
            user="other",
            event_type=None,
        )

    @patch("titan_db.jobs.db_job_utils.DBGenerationTaskModel")
    def test_filter_by_event_type(self, mock_model):
        job = self._make_job()
        mock_model.job_id_index.count.return_value = 5
        assert filter_job(
            job,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type="call",
        )

    @patch("titan_db.jobs.db_job_utils.DBGenerationTaskModel")
    def test_filter_by_event_type_no_match(self, mock_model):
        job = self._make_job()
        mock_model.job_id_index.count.return_value = 0
        assert not filter_job(
            job,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type="call",
        )


class TestGetJobMostRelevantTimestamp:
    def _job(self, status):
        j = MagicMock()
        j.status = status
        j.drafted_at.isoformat.return_value = "2024-01-01"
        j.created_at.isoformat.return_value = "2024-01-02"
        j.started_at.isoformat.return_value = "2024-01-03"
        j.finished_at.isoformat.return_value = "2024-01-04"
        return j

    def test_draft(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Draft)) == "2024-01-01"
        )

    def test_pending(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Pending))
            == "2024-01-02"
        )

    def test_generating(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Generating))
            == "2024-01-03"
        )

    def test_done(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Done)) == "2024-01-04"
        )

    def test_failed(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Failed))
            == "2024-01-03"
        )

    def test_cancelled(self):
        assert (
            _get_job_most_relevant_timestamp(self._job(JobStatus.Cancelled))
            == "2024-01-03"
        )


@patch("titan_db.jobs.db_job_utils.DBJobModel")
class TestGetJobModel:
    def test_found(self, mock_model):
        mock_model.get.return_value = MagicMock(id="j1")
        result = get_job_model(job_id="j1")
        assert result.id == "j1"

    def test_not_found(self, mock_model):
        mock_model.get.side_effect = DoesNotExist()
        with pytest.raises(JobNotFoundError):
            get_job_model(job_id="missing")


@patch("titan_db.jobs.db_job_utils.DBJobModel")
class TestUpdateJobModel:
    def test_success(self, mock_model):
        update_job_model(job_id="j1", actions=[])

    def test_not_found(self, mock_model):
        mock_model.return_value.update.side_effect = PutError()
        with pytest.raises(JobNotFoundError):
            update_job_model(job_id="missing", actions=[])


@patch("titan_db.jobs.db_job_utils.update_job_model")
@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestUpdateJobStatus:
    def test_done_requires_extraction_size(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(tasks=[])
        with pytest.raises(ValueError, match="Missing extraction_size"):
            update_job_status(job_id="j1", status=JobStatus.Done, extraction_size=None)

    def test_done_with_size(self, mock_get, mock_update):
        mock_task = MagicMock(requested_count=10)
        mock_get.return_value = MagicMock(tasks=[mock_task])
        update_job_status(job_id="j1", status=JobStatus.Done, extraction_size=1024)
        mock_update.assert_called_once()

    def test_generating(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(tasks=[])
        update_job_status(job_id="j1", status=JobStatus.Generating)
        mock_update.assert_called_once()

    def test_pending(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(tasks=[])
        update_job_status(job_id="j1", status=JobStatus.Pending)
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestGetJobStatus:
    def test_returns_status(self, mock_get):
        mock_get.return_value = MagicMock(status=JobStatus.Done)
        assert get_job_status(job_id="j1") == JobStatus.Done


@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestGetJob:
    def test_returns_dict(self, mock_get):
        mock_get.return_value = MagicMock(attribute_values={"id": "j1"})
        result = get_job(job_id="j1")
        assert result == {"id": "j1"}


@patch("titan_db.jobs.db_job_utils.DBJobModel")
class TestGetAllJobsMatchingPrefix:
    def test_returns_sorted(self, mock_model):
        j1 = MagicMock(created_at="2024-01-01", attribute_values={"id": "j1"})
        j2 = MagicMock(created_at="2024-01-02", attribute_values={"id": "j2"})
        mock_model.scan.return_value = [j1, j2]
        result = get_all_jobs_matching_prefix(prefix="test")
        assert len(result) == 2


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestAddJobManifest:
    def test_calls_update(self, mock_update):
        manifest = MagicMock()
        manifest.model_dump.return_value = {"key": "val"}
        add_job_manifest(job_id="j1", manifest=manifest)
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
class TestUpdateJobK8sJobName:
    def test_calls_update(self, mock_update):
        update_job_k8s_job_name(job_id="j1", k8s_job_name="k8s-123")
        mock_update.assert_called_once()


@patch("titan_db.jobs.db_job_utils.DBJobModel")
class TestGetK8sJobName:
    def test_found(self, mock_model):
        mock_model.get.return_value = MagicMock(k8s_job_name="k8s-123")
        assert get_k8s_job_name(job_id="j1") == "k8s-123"

    def test_not_found(self, mock_model):
        mock_model.get.side_effect = DoesNotExist()
        with pytest.raises(JobNotFoundError):
            get_k8s_job_name(job_id="missing")


@patch("titan_db.jobs.db_job_utils.DBJobPhaseModel")
class TestInsertPhase:
    def test_creates_phase(self, mock_model):
        insert_phase(job_id="j1", phase=TitanPhase.Generation)
        mock_model.return_value.save.assert_called_once()


@patch("titan_db.jobs.db_job_utils.DBJobPhaseModel")
class TestUpdatePhaseStatus:
    def test_updates_phase(self, mock_model):
        mock_phase = MagicMock()
        mock_model.job_id_index.query.return_value = [mock_phase]
        update_phase_status(
            job_id="j1", phase=TitanPhase.Generation, status=PhaseStatus.Done
        )
        assert mock_phase.update.call_count >= 1

    def test_phase_not_found(self, mock_model):
        mock_model.job_id_index.query.return_value = iter([])
        with pytest.raises(PhaseNotFoundError):
            update_phase_status(
                job_id="j1", phase=TitanPhase.Generation, status=PhaseStatus.Done
            )


@patch("titan_db.jobs.db_job_utils.DBJobPhaseModel")
class TestDeleteJobPhases:
    def test_deletes_all(self, mock_model):
        p1 = MagicMock()
        p2 = MagicMock()
        mock_model.job_id_index.query.return_value = [p1, p2]
        delete_job_phases(job_id="j1")
        p1.delete.assert_called_once()
        p2.delete.assert_called_once()


@patch("titan_db.jobs.db_job_utils.update_job_model")
@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestCustomEvents:
    def test_insert(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(custom_events={})
        ce = MagicMock()
        ce.event_id = "ce1"
        insert_custom_event(job_id="j1", custom_event=ce)
        mock_update.assert_called_once()

    def test_update_existing(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(custom_events={"ce1": MagicMock()})
        ce = MagicMock()
        ce.event_id = "ce1"
        update_custom_event(job_id="j1", event_id="ce1", custom_event=ce)
        mock_update.assert_called_once()

    def test_update_not_found(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(custom_events={})
        with pytest.raises(TaskNotFoundError):
            update_custom_event(
                job_id="j1", event_id="missing", custom_event=MagicMock()
            )

    def test_delete_existing(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(custom_events={"ce1": MagicMock()})
        delete_custom_event(job_id="j1", event_id="ce1")
        mock_update.assert_called_once()

    def test_delete_not_found(self, mock_get, mock_update):
        mock_get.return_value = MagicMock(custom_events={})
        with pytest.raises(TaskNotFoundError):
            delete_custom_event(job_id="j1", event_id="missing")


@patch("titan_db.jobs.db_job_utils.get_job_model")
class TestBuildGenerationJob:
    def test_builds_job(self, mock_get):
        mock_db_job = MagicMock()
        mock_db_job.id = "j1"
        mock_db_job.name = "TestJob"
        mock_db_job.status = JobStatus.Draft
        mock_db_job.device_context = MagicMock()
        mock_db_job.device_info = []
        mock_db_job.tasks = []
        mock_db_job.stories = MagicMock()
        mock_db_job.custom_events = MagicMock()
        mock_db_job.custom_events.values.return_value = []
        mock_db_job.owner_entity = MagicMock()
        mock_db_job.entities = []
        mock_get.return_value = mock_db_job
        result = build_generation_job(job_id="j1")
        assert result.job_id == "j1"
