from model.types import EventType, DeviceInfoEntry, DeviceInfo
from metafinder_core.models import AppModel
from model_tests.test_utils import create_test_generation_job
from titan_db.events import db

from pytest_mock import MockerFixture

from generation.simulation.events.contractors.apps import InstalledAppContractor
from generation import engine, foreman
from generation_tests.mocks.data.job import MOCK_GENERATION_JOB, MOCK_GENERATION_JOB_WITH_APPS
from generation_tests.mocks.data.metafinder import APPS_MF_RESPONSE


class TestEngine:

    def test_setup_device(self, mocker: MockerFixture):
        mocker.patch("generation.engine._create_device_info")
        mocker.patch("generation.engine._install_apps")
        job = MOCK_GENERATION_JOB
        job = create_test_generation_job(job_id=job.job_id, tasks=job.tasks, context=job.context)
        device_info_spy = mocker.spy(engine, "_create_device_info")
        apps_spy = mocker.spy(engine, "_install_apps")
        engine._setup_device(job=job)
        device_info_spy.assert_called_once_with(job=job)
        apps_spy.assert_called_once_with(job=job)

    def test_create_device_info(self, mocker: MockerFixture):
        mocker.patch("titan_db.events.db.write_device_info")
        job = MOCK_GENERATION_JOB
        device_info = [
            DeviceInfoEntry(key='key1', value='value1'),
            DeviceInfoEntry(key='key2', value='value2')
        ]
        job = create_test_generation_job(job_id=job.job_id, tasks=job.tasks, context=job.context, device_info=device_info)
        write_device_info_spy = mocker.spy(db, "write_device_info")
        engine._create_device_info(job=job)
        write_device_info_spy.assert_called_once()

    def test_install_apps_with_apps(self, mocker: MockerFixture):
        write_events_patch = mocker.patch("titan_db.events.db.write_events")
        metafinder_patch = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
        metafinder_patch.return_value = [AppModel.model_validate(app) for app in APPS_MF_RESPONSE]
        job = MOCK_GENERATION_JOB_WITH_APPS
        apps_contractor_spy = mocker.spy(InstalledAppContractor, "construct_by_ids")
        foreman_spy = mocker.spy(foreman, "hire_contractor")
        app_ids = [t.app_id for t in job.tasks if t.app_id]
        job = create_test_generation_job(job_id=job.job_id, tasks=job.tasks, context=job.context)
        engine._install_apps(job=job)
        foreman_spy.assert_called_once_with(event_type=EventType.APP, job=job)
        contractor = foreman_spy.spy_return
        apps_contractor_spy.assert_called_once_with(self=contractor, app_ids=app_ids)
        apps = apps_contractor_spy.spy_return
        write_events_patch.assert_called_once_with(job_id=job.job_id, events=apps)
