from datetime import datetime, timedelta

import moto
import pytest

from model.tasks import ChatTask
from model.tasks import LocationTask
from model.status import JobStatus
from model.types import EventType
from model_tests.test_utils import create_test_generation_job

#TODO these tests somehow pass, but need to be fixed. The signature of insert_job has changed.

@moto.mock_aws
class TestInsertJob:

    def test_insert_job(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        job = create_test_generation_job(
            job_id='123',
            name='Test Job',
            tasks=[
                ChatTask(quantity=100)
            ]
        )
        job_model_patch = mocker.patch.object(DBJobModel, 'save')

        result = insert_job(job)

        assert result == '123'
        job_model_patch.assert_called_once()

    def test_insert_job_empty_tasks(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        job = create_test_generation_job(
            job_id='123',
            name='Test Job'
        )
        job_model_patch = mocker.patch.object(DBJobModel, 'save')

        result = insert_job(job)

        assert result == '123'
        job_model_patch.assert_called_once()

    def test_insert_job_database_write_failure(self, mocker):
        from titan_db.jobs.models import DBJobModel
        from titan_db.jobs.db_job_utils import insert_job

        job = create_test_generation_job(
            job_id='123',
            name='Test Job',
            tasks=[
                LocationTask(quantity=100)
            ]
        )
        job_model_patch = mocker.patch.object(DBJobModel, 'save', side_effect=Exception)

        # Act and Assert
        with pytest.raises(Exception):
            insert_job(job)
        job_model_patch.assert_called_once()

@moto.mock_aws
class TestFilterJob:

    def test_job_matches_all_filters(self):

        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )

        assert filter_job(job, 'test_job', JobStatus.Done, EventType.CHAT, 2, 5) is True

    def test_job_matches_some_filters(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, 'test_job', JobStatus.Done, EventType.POWERING_EVENT, 2, 5) is False

    def test_empty_fields(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, None, None, None, None, None) is True

    def test_job_matches_only_name_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, 'test_job', '', '', None, None) is True

    def test_job_not_matches_only_name_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, 'prod_job', '', '', None, None) is False

    def test_job_matches_only_status_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', JobStatus.Done, '', None, None) is True

    def test_job_not_matches_only_status_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', JobStatus.Generating, '', None, None) is False

    def test_job_matches_only_event_type_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, EventType.CHAT, None, None) is True

    def test_job_not_matches_only_event_type_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, EventType.LOCATION, None, None) is False

    def test_job_matches_only_min_events_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, None, 2, None) is True

    def test_job_not_matches_only_min_events_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, None, 5, None) is False

    def test_job_matches_only_max_events_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, None, None, 5) is True

    def test_job_not_matches_only_max_events_filter(self):
        from titan_db.jobs.db_job_utils import filter_job
        from titan_db.jobs.models import DBJobModel

        job = DBJobModel(
            name='test_job',
            status=JobStatus.Done,
            event_types=[EventType.CHAT],
            total_events=4
        )
        assert filter_job(job, '', None, None, None, 0) is False

@moto.mock_aws
class TestGetAllJobs:

    def test_get_all_jobs(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name='job1', status=JobStatus.Done, created_at=datetime.now(), event_types=[EventType.CHAT], total_events=4
        )
        job2 = DBJobModel(
            name='job2', status=JobStatus.Generating, created_at=datetime.now(), event_types=[EventType.IMAGE], total_events=10
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, 'scan')
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(page=1, name='', status='', events='', events_min=0, events_max=10)

        assert len(result) == 2
        assert count == 2
        assert result[0]['name'] == 'job2'
        assert result[1]['name'] == 'job1'

    def test_get_all_jobs_empty_params(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name='job1', status=JobStatus.Done, created_at=datetime.now(), event_types=[EventType.CHAT], total_events=4
        )
        job2 = DBJobModel(
            name='job2', status=JobStatus.Generating, created_at=datetime.now(), event_types=[EventType.IMAGE],
            total_events=10
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, 'scan')
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(page=1, name='', status=JobStatus.Generating, events='', events_min=0, events_max=10)

        assert len(result) == 1
        assert count == 1
        assert result[0]['name'] == 'job2'

    # Tests the function with invalid inputs for parameters (e.g. non-existent job name).
    def test_get_all_jobs_invalid_input(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name='job1', status=JobStatus.Done, created_at=datetime.now(), event_types=[EventType.CHAT], total_events=4
        )
        job2 = DBJobModel(
            name='job2', status=JobStatus.Generating, created_at=datetime.now(), event_types=[EventType.IMAGE],
            total_events=10
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, 'scan')
        jobs_query_mock.return_value = [job1, job2]

        result, count = get_all_jobs(page=1, name='job3', status='', events='', events_min=0, events_max=10)

        assert len(result) == 0
        assert count == 0

    def test_get_all_jobs_sorting(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs
        from titan_db.jobs.models import DBJobModel

        job1 = DBJobModel(
            name='job1', status=JobStatus.Done, created_at=datetime.now() - timedelta(days=1), event_types=[EventType.CHAT], total_events=4
        )
        job2 = DBJobModel(
            name='job2', status=JobStatus.Generating, created_at=datetime.now(), event_types=[EventType.IMAGE],
            total_events=10
        )
        jobs_query_mock = mocker.patch.object(DBJobModel, 'scan')
        jobs_query_mock.return_value = [job1, job2]

        # Execution
        result, count = get_all_jobs(page=1, name='', status='', events='', events_min=0, events_max=10)

        # Assertion
        assert len(result) == 2
        assert count == 2
        assert result[0]['name'] == 'job2'
        assert result[1]['name'] == 'job1'

@moto.mock_aws
class TestGetAllJobsMatchingPrefix:

    def test_multiple_jobs_matching_prefix(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = 'test'
        job1 = DBJobModel(name='test_job1', created_at=datetime.now())
        job2 = DBJobModel(name='test_job2', created_at=datetime.now())
        mocker.patch.object(DBJobModel, 'scan', return_value=[job1, job2])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 2
        assert result[0]['name'] == 'test_job2'
        assert result[1]['name'] == 'test_job1'

    def test_one_job_matching_prefix(self, mocker):

        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = 'test'
        job = DBJobModel(name='test_job', created_at=datetime.now())
        mocker.patch.object(DBJobModel, 'scan', return_value=[job])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 1
        assert result[0]['name'] == 'test_job'

    def test_empty_prefix(self, mocker):
        from titan_db.jobs.db_job_utils import get_all_jobs_matching_prefix
        from titan_db.jobs.models import DBJobModel

        prefix = ''
        job = DBJobModel(name='test_job', created_at=datetime.now())
        mocker.patch.object(DBJobModel, 'scan', return_value=[job])

        result = get_all_jobs_matching_prefix(prefix)

        assert len(result) == 1
