from unittest.mock import call

import pytest
from pytest_mock import MockerFixture

from core.config import SETTINGS
from model.tasks import UploadedFileTask
from model.types import EventType
from model.status import JobStatus

from api import operations
from api_tests.mocks.data.job import (
    MOCK_GENERATION_JOB,
    MOCK_JOB_ID,
    MOCK_JOB_NAME,
    MOCK_NEW_JOB,
)
from api_tests.mocks.s3_client import MockS3Client
from model_tests.test_utils import create_test_generation_job

m = MockerFixture({})
m.patch("pynamodb.models.Model.exists", return_value=True)


def test_create_new_job(mocker: MockerFixture):
    build_generation_job_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.build_generation_job", return_value=MOCK_NEW_JOB
    )
    verify_uploads_patch = mocker.patch(
        "api.operations.verify_uploaded_files_exist_or_fail"
    )
    update_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.update_job_status"
    )
    dispatcher_mock = mocker.Mock()
    dispatcher_mock.run_generation_job.return_value = "gen-abcd1234-abc123"
    update_job_k8s_job_name_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.update_job_k8s_job_name"
    )

    result = operations.run_job(MOCK_JOB_ID, dispatcher_mock)

    assert result == MOCK_NEW_JOB
    assert build_generation_job_patch.call_count == 1
    build_generation_job_patch.assert_called_with(job_id=MOCK_JOB_ID)
    verify_uploads_patch.assert_called_once_with(job=MOCK_NEW_JOB)
    update_job_status_patch.assert_called_once_with(
        job_id=MOCK_JOB_ID, status=JobStatus.Pending
    )
    dispatcher_mock.run_generation_job.assert_called_once_with(job_id=MOCK_JOB_ID)
    update_job_k8s_job_name_patch.assert_called_once()


def test_re_run_job(mocker: MockerFixture):
    get_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_job_status", return_value=JobStatus.Done
    )
    delete_phases_patch = mocker.patch("titan_db.jobs.db_job_utils.delete_job_phases")
    update_status_patch = mocker.patch("titan_db.jobs.db_job_utils.update_job_status")
    dispatcher_mock = mocker.Mock()
    dispatcher_mock.run_generation_job.return_value = "gen-abcd1234-abc123"
    update_job_k8s_job_name_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.update_job_k8s_job_name"
    )
    build_generation_job_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.build_generation_job", return_value=MOCK_NEW_JOB
    )

    result = operations.re_run_job(job_id=MOCK_JOB_ID, dispatcher=dispatcher_mock)

    get_job_status_patch.assert_called_once_with(job_id=MOCK_JOB_ID)
    delete_phases_patch.assert_called_once_with(job_id=MOCK_JOB_ID)
    update_status_patch.assert_called_once_with(
        job_id=MOCK_JOB_ID, status=JobStatus.Pending
    )
    dispatcher_mock.run_generation_job.assert_called_once_with(job_id=MOCK_JOB_ID)
    update_job_k8s_job_name_patch.assert_called_once()
    build_generation_job_patch.assert_called_once_with(job_id=MOCK_JOB_ID)
    assert result.job_id == MOCK_JOB_ID


@pytest.mark.parametrize(
    "job_status", [JobStatus.Generating, JobStatus.Converting, JobStatus.Finalizing]
)
def test_cancel_running_job(mocker: MockerFixture, job_status: JobStatus):
    job_id = "abcd"
    get_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
    )
    k8s_job_name = "gen-abcd-1234"
    get_k8s_job_name_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_k8s_job_name", return_value=k8s_job_name
    )
    dispatcher_mock = mocker.patch(
        "api.dispatcher.Dispatcher", return_value=mocker.Mock()
    )
    update_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.update_job_status"
    )

    operations.cancel_job(job_id=job_id, dispatcher=dispatcher_mock)

    get_job_status_patch.assert_called_once_with(job_id=job_id)
    get_k8s_job_name_patch.assert_called_once_with(job_id=job_id)
    dispatcher_mock.stop_generation_job.assert_called_once_with(
        k8s_job_name=k8s_job_name
    )
    update_job_status_patch.assert_called_once_with(
        job_id=job_id, status=JobStatus.Cancelled
    )


@pytest.mark.parametrize(
    "job_status",
    [JobStatus.Done, JobStatus.Failed, JobStatus.Pending, JobStatus.Cancelled],
)
def test_cancel_done_job(mocker: MockerFixture, job_status: JobStatus):
    job_id = "abcd"
    get_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
    )
    k8s_job_name = "gen-abcd-1234"
    get_k8s_job_name_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_k8s_job_name", return_value=k8s_job_name
    )
    dispatcher_mock = mocker.patch(
        "api.dispatcher.Dispatcher", return_value=mocker.Mock()
    )
    update_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.update_job_status"
    )

    operations.cancel_job(job_id=job_id, dispatcher=dispatcher_mock)

    get_job_status_patch.assert_called_once_with(job_id=job_id)
    get_k8s_job_name_patch.assert_not_called()
    dispatcher_mock.stop_generation_job.assert_not_called()
    update_job_status_patch.assert_not_called()


@pytest.mark.parametrize(
    "job_status",
    [
        JobStatus.Done,
        JobStatus.Failed,
        JobStatus.Pending,
        JobStatus.Cancelled,
        JobStatus.Draft,
    ],
)
def test_delete_job_status_done(mocker: MockerFixture, job_status: JobStatus):
    job_id = "1234"
    get_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
    )
    _delete_job_patch = mocker.patch("api.operations._delete_job")
    dispatcher_mock = mocker.patch(
        "api.dispatcher.Dispatcher", return_value=mocker.Mock()
    )

    result = operations.delete_job(job_id=job_id, dispatcher=dispatcher_mock)

    get_job_status_patch.assert_called_once_with(job_id=job_id)
    _delete_job_patch.assert_called_once_with(job_id=job_id)
    assert result == job_id


@pytest.mark.parametrize(
    "job_status", [JobStatus.Generating, JobStatus.Converting, JobStatus.Finalizing]
)
def test_delete_job_status_generating(mocker: MockerFixture, job_status: JobStatus):
    job_id = "1234"
    get_job_status_patch = mocker.patch(
        "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
    )
    cancel_job_patch = mocker.patch("api.operations.cancel_job")
    _delete_job_patch = mocker.patch("api.operations._delete_job")
    dispatcher_mock = mocker.patch(
        "api.dispatcher.Dispatcher", return_value=mocker.Mock()
    )

    result = operations.delete_job(job_id=job_id, dispatcher=dispatcher_mock)

    get_job_status_patch.assert_called_once_with(job_id=job_id)
    cancel_job_patch.assert_called_once_with(job_id=job_id, dispatcher=dispatcher_mock)
    _delete_job_patch.assert_called_once_with(job_id=job_id)
    assert result == job_id


def test_get_all_jobs(mocker: MockerFixture):
    db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
    db_result = ([], 0)
    db_patch.return_value = db_result
    kwargs = {
        "page": 1,
        "page_size": 20,
        "name": "test-job",
        "status": JobStatus.Done,
        "exclude_status": None,
        "user": "test-user",
        "event_type": None,
    }
    result = operations.get_all_jobs(**kwargs)
    db_patch.assert_called_once_with(**kwargs)
    assert result == db_result


def test_get_all_jobs_matching_prefix(mocker: MockerFixture):
    db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs_matching_prefix")
    db_result = [{}]
    db_patch.return_value = db_result
    prefix = "ab"
    result = operations.get_all_jobs_matching_prefix(prefix)
    db_patch.assert_called_once_with(prefix=prefix)
    assert result == db_result


def test_get_job_status(mocker: MockerFixture):
    db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_job_status")
    db_result = JobStatus.Done
    db_patch.return_value = db_result
    job_id = "ab"
    result = operations.get_job_status(job_id)
    db_patch.assert_called_once_with(job_id=job_id)
    assert result == db_result


def test_get_job(mocker: MockerFixture):
    job_id = "1234"
    job_patch = mocker.patch("titan_db.jobs.db_job_utils.build_generation_job")
    job_patch.return_value = MOCK_GENERATION_JOB

    result = operations.get_job(job_id)

    job_patch.assert_called_once_with(job_id=job_id)
    assert result == MOCK_GENERATION_JOB


def test_private_delete_job(mocker: MockerFixture):
    job_id = "1234"
    delete_events_patch = mocker.patch("titan_db.events.db.delete_job")
    db_delete_job_patch = mocker.patch("titan_db.jobs.db_job_utils.delete_job")

    operations._delete_job(job_id=job_id)

    delete_events_patch.assert_called_once_with(
        job_id=job_id, raise_error_on_missing=False
    )
    db_delete_job_patch.assert_called_once_with(job_id=job_id)


def test_download_ufdr(mocker: MockerFixture):
    get_job_patch = mocker.patch("api.operations.get_job")
    get_presigned_url_patch = mocker.patch(
        "api_tests.mocks.s3_client.MockS3Client.get_download_presigned_url",
    )
    mocker.patch(
        "api_tests.mocks.s3_client.MockS3Client.get_file_size",
        return_value=1024,
    )
    job_id = "1234"
    job_name = "test"

    mock_job = create_test_generation_job(job_id=job_id, name=job_name)
    get_job_patch.return_value = mock_job

    operations.download_ufdr(job_id=job_id, s3_client=MockS3Client())

    get_job_patch.assert_called_once_with(job_id=job_id)
    get_presigned_url_patch.assert_called_once_with(
        bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME,
        file_name=f"jobs/{job_id}/{job_name}.ufdr",
    )


def test_missing_uploads(mocker: MockerFixture):
    # Job with both existing and missing uploaded files
    tasks = [
        UploadedFileTask(
            event_type=EventType.IMAGE,
            file_name="missing1.jpg",
            md5="existing_md5",
            file_size=1,
        ),
        UploadedFileTask(
            event_type=EventType.IMAGE,
            file_name="existing.jpg",
            md5="missing1_md5",
            file_size=1,
        ),
        UploadedFileTask(
            event_type=EventType.IMAGE,
            file_name="missing2.jpg",
            md5="missing2_md5",
            file_size=1,
        ),
    ]
    job = create_test_generation_job(tasks=tasks)
    expected_outputs = [
        False,
        True,
        False,
    ]  # Expected return values for "does_prefix_exist" (2 missing, 1 valid)

    does_prefix_exist_patch = mocker.patch(
        "core.s3_client.TitanS3Client.does_prefix_exist", side_effect=expected_outputs
    )

    with pytest.raises(KeyError):
        operations.verify_uploaded_files_exist_or_fail(job=job)

    does_prefix_exist_patch.assert_has_calls(
        [
            call(
                prefix=f"uploads/{task.md5}", bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME
            )
            for task in job.tasks
        ]
    )

    assert does_prefix_exist_patch.call_count == 3


class TestGetAllJobs:

    def test_get_all_jobs_with_status_filter(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [{"id": "job-1", "status": "Done"}]
        db_patch.return_value = (mock_jobs, 1)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=JobStatus.Done,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert result == (mock_jobs, 1)
        db_patch.assert_called_once_with(
            page=1,
            page_size=20,
            name=None,
            status=JobStatus.Done,
            exclude_status=None,
            user=None,
            event_type=None,
        )

    def test_get_all_jobs_with_exclude_status(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [
            {"id": "job-1", "status": "Done"},
            {"id": "job-2", "status": "Pending"},
        ]
        db_patch.return_value = (mock_jobs, 2)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=JobStatus.Draft,
            user=None,
            event_type=None,
        )

        assert result == (mock_jobs, 2)
        db_patch.assert_called_once_with(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=JobStatus.Draft,
            user=None,
            event_type=None,
        )

    def test_get_all_jobs_with_user_filter(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [{"id": "job-1", "user": "alice"}]
        db_patch.return_value = (mock_jobs, 1)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user="alice",
            event_type=None,
        )

        assert result == (mock_jobs, 1)
        db_patch.assert_called_once_with(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user="alice",
            event_type=None,
        )

    def test_get_all_jobs_with_name_search(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [{"id": "job-1", "name": "test-job-1"}]
        db_patch.return_value = (mock_jobs, 1)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name="test-job",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert result == (mock_jobs, 1)
        db_patch.assert_called_once_with(
            page=1,
            page_size=20,
            name="test-job",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

    def test_get_all_jobs_pagination(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [{"id": f"job-{i}"} for i in range(10)]
        db_patch.return_value = (mock_jobs, 50)

        result = operations.get_all_jobs(
            page=3,
            page_size=10,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        jobs, total = result
        assert len(jobs) == 10
        assert total == 50
        db_patch.assert_called_once_with(
            page=3,
            page_size=10,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

    def test_get_all_jobs_with_event_type_filter(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        mock_jobs = [{"id": "job-1", "event_types": ["chat messages"]}]
        db_patch.return_value = (mock_jobs, 1)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=EventType.CHAT,
        )

        assert result == (mock_jobs, 1)
        db_patch.assert_called_once_with(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=EventType.CHAT,
        )

    def test_get_all_jobs_empty_result(self, mocker: MockerFixture):
        db_patch = mocker.patch("titan_db.jobs.db_job_utils.get_all_jobs")
        db_patch.return_value = ([], 0)

        result = operations.get_all_jobs(
            page=1,
            page_size=20,
            name="nonexistent",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        jobs, total = result
        assert jobs == []
        assert total == 0


class TestReRunJob:

    def test_re_run_draft_job_raises_exception(self, mocker: MockerFixture):
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_job_status", return_value=JobStatus.Draft
        )
        dispatcher_mock = mocker.Mock()

        with pytest.raises(Exception, match="Could not re-run job"):
            operations.re_run_job(job_id="draft-job-123", dispatcher=dispatcher_mock)


class TestCancelJob:

    @pytest.mark.parametrize(
        "job_status",
        [
            JobStatus.Generating,
            JobStatus.Converting,
            JobStatus.Finalizing,
        ],
    )
    def test_cancel_running_job_returns_true(
        self, mocker: MockerFixture, job_status: JobStatus
    ):
        job_id = "running-job-123"
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
        )
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_k8s_job_name", return_value="gen-abc-123"
        )
        mocker.patch("titan_db.jobs.db_job_utils.update_job_status")
        dispatcher_mock = mocker.Mock()
        dispatcher_mock.stop_generation_job.return_value = True

        result = operations.cancel_job(job_id=job_id, dispatcher=dispatcher_mock)

        assert result is True

    @pytest.mark.parametrize(
        "job_status",
        [
            JobStatus.Done,
            JobStatus.Failed,
            JobStatus.Pending,
            JobStatus.Cancelled,
            JobStatus.Draft,
        ],
    )
    def test_cancel_non_running_job_returns_false(
        self, mocker: MockerFixture, job_status: JobStatus
    ):
        job_id = "non-running-job-123"
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_job_status", return_value=job_status
        )

        dispatcher_mock = mocker.Mock()

        result = operations.cancel_job(job_id=job_id, dispatcher=dispatcher_mock)

        assert result is False

    def test_cancel_job_raises_when_dispatcher_fails(self, mocker: MockerFixture):
        job_id = "job-123"
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_job_status",
            return_value=JobStatus.Generating,
        )
        mocker.patch(
            "titan_db.jobs.db_job_utils.get_k8s_job_name", return_value="gen-abc-123"
        )
        dispatcher_mock = mocker.Mock()
        dispatcher_mock.stop_generation_job.return_value = False

        with pytest.raises(Exception, match="Could not cancel job"):
            operations.cancel_job(job_id=job_id, dispatcher=dispatcher_mock)


class TestGetTaskProgress:

    def test_get_task_progress(self, mocker: MockerFixture):
        from model.status import GenerationTaskStatus

        db_patch = mocker.patch("titan_db.jobs.db_task_utils.get_task_progress")
        db_patch.return_value = (GenerationTaskStatus.Generating, 0.75)

        result = operations.get_task_progress(task_id="task-123")

        db_patch.assert_called_once_with(task_id="task-123")
        status, progress = result
        assert status == GenerationTaskStatus.Generating
        assert progress == 0.75


class TestUploadOperations:

    def test_does_uploaded_file_exists_returns_true(self, mocker: MockerFixture):
        s3_client_mock = mocker.Mock()
        s3_client_mock.does_prefix_exist.return_value = True

        result = operations.does_uploaded_file_exists(
            file_md5="abc123", s3_client=s3_client_mock
        )

        assert result is True
        s3_client_mock.does_prefix_exist.assert_called_once_with(
            prefix="uploads/abc123", bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME
        )

    def test_does_uploaded_file_exists_returns_false(self, mocker: MockerFixture):
        s3_client_mock = mocker.Mock()
        s3_client_mock.does_prefix_exist.return_value = False

        result = operations.does_uploaded_file_exists(
            file_md5="nonexistent", s3_client=s3_client_mock
        )

        assert result is False

    def test_get_upload_presigned_url(self, mocker: MockerFixture):
        from model.uploads import UploadedFilePresignedUrl

        s3_client_mock = mocker.Mock()
        mock_result = UploadedFilePresignedUrl(
            url="https://s3.amazonaws.com/presigned-url",
            fields={"key": "value"},
        )
        s3_client_mock.get_upload_presigned_url.return_value = mock_result

        result = operations.get_upload_presigned_url(
            file_name="test-file.jpg", s3_client=s3_client_mock
        )

        assert result == mock_result
        s3_client_mock.get_upload_presigned_url.assert_called_once_with(
            file_name="uploads/test-file.jpg", bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME
        )
