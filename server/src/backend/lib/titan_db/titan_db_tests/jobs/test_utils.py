from datetime import date, datetime, timedelta

import moto
import pytest

from model.device_models import DeviceModel
from model.job import DeviceContext
from model.status import JobStatus
from model.types import EventType, DeviceInfoEntry, OwnerEntity


@moto.mock_aws
class TestInsertJob:

    def _make_insert_args(self):
        return dict(
            user="testuser",
            name="Test Job",
            owner_entity=OwnerEntity(
                first_name="Test",
                last_name="User",
                phone="+1234567890",
                email="test@test.com",
                is_male=True,
            ),
            device_context=DeviceContext(
                device=DeviceModel(manufacturer="Test", name="TestModel", os="android"),
                start_date=date.today() - timedelta(days=365),
                end_date=date.today(),
            ),
            device_info=[],
        )

    def test_insert_job(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        job_model_patch = mocker.patch.object(DBJobModel, "save")
        mocker.patch.object(DBJobModel, "id", "test-id-123", create=True)

        result = insert_job(**self._make_insert_args())

        job_model_patch.assert_called_once()

    def test_insert_job_empty_name(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        job_model_patch = mocker.patch.object(DBJobModel, "save")
        mocker.patch.object(DBJobModel, "id", "test-id-456", create=True)

        args = self._make_insert_args()
        args["name"] = None
        result = insert_job(**args)

        job_model_patch.assert_called_once()

    def test_insert_job_database_write_failure(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        mocker.patch.object(DBJobModel, "save", side_effect=Exception)

        with pytest.raises(Exception):
            insert_job(**self._make_insert_args())


@moto.mock_aws
class TestFilterJob:

    def test_job_matches_all_filters(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )

        assert (
            filter_job(job, "test_job", JobStatus.Done, None, "testuser", None) is True
        )

    def test_job_name_mismatch(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, "prod_job", None, None, None, None) is False

    def test_empty_filters(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, None, None, None, None) is True

    def test_job_matches_name_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, "test_job", None, None, None, None) is True

    def test_job_not_matches_name_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, "other", None, None, None, None) is False

    def test_job_matches_status_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, JobStatus.Done, None, None, None) is True

    def test_job_not_matches_status_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, JobStatus.Generating, None, None, None) is False

    def test_job_excluded_by_exclude_status(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, None, JobStatus.Done, None, None) is False

    def test_job_not_excluded_by_exclude_status(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, None, JobStatus.Draft, None, None) is True

    def test_job_matches_user_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, None, None, "testuser", None) is True

    def test_job_not_matches_user_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name="test_job",
            status=JobStatus.Done,
            user="testuser",
        )
        assert filter_job(job, None, None, None, "otheruser", None) is False


@moto.mock_aws
class TestGetAllJobs:

    def test_get_all_jobs(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name="job1",
            status=JobStatus.Done,
            finished_at=datetime.now(),
            user="testuser",
        )
        job2 = DBJobModel(
            name="job2",
            status=JobStatus.Generating,
            started_at=datetime.now(),
            user="testuser",
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, "scan")
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert len(result) == 2
        assert count == 2

    def test_get_all_jobs_filtered_by_status(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name="job1",
            status=JobStatus.Done,
            finished_at=datetime.now(),
            user="testuser",
        )
        job2 = DBJobModel(
            name="job2",
            status=JobStatus.Generating,
            started_at=datetime.now(),
            user="testuser",
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, "scan")
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=JobStatus.Generating,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert len(result) == 1
        assert count == 1

    def test_get_all_jobs_invalid_input(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name="job1",
            status=JobStatus.Done,
            finished_at=datetime.now(),
            user="testuser",
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, "scan")
        jobs_query_mock.return_value = [job1]

        result, count = get_all_jobs(
            page=1,
            page_size=20,
            name="nonexistent",
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert len(result) == 0
        assert count == 0

    def test_get_all_jobs_sorting(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name="job1",
            status=JobStatus.Done,
            finished_at=datetime.now() - timedelta(days=1),
            user="testuser",
        )
        job2 = DBJobModel(
            name="job2",
            status=JobStatus.Generating,
            started_at=datetime.now(),
            user="testuser",
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, "scan")
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(
            page=1,
            page_size=20,
            name=None,
            status=None,
            exclude_status=None,
            user=None,
            event_type=None,
        )

        assert len(result) == 2
        assert count == 2


@moto.mock_aws
class TestGetAllJobsMatchingPrefix:

    def test_multiple_jobs_matching_prefix(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = "test"
        job1 = DBJobModel(name="test_job1", created_at=datetime.now())
        job2 = DBJobModel(name="test_job2", created_at=datetime.now())
        mocker.patch.object(DBJobModel, "scan", return_value=[job1, job2])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 2
        assert result[0]["name"] == "test_job2"
        assert result[1]["name"] == "test_job1"

    def test_one_job_matching_prefix(self, mocker):

        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = "test"
        job = DBJobModel(name="test_job", created_at=datetime.now())
        mocker.patch.object(DBJobModel, "scan", return_value=[job])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 1
        assert result[0]["name"] == "test_job"

    def test_empty_prefix(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = ""
        job = DBJobModel(name="test_job", created_at=datetime.now())
        mocker.patch.object(DBJobModel, "scan", return_value=[job])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 1
