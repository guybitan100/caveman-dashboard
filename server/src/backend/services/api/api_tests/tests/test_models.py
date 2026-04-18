from api.models import JobsListResponse, TaskProgressResponse, GenerateEntityRequest
from model.status import GenerationTaskStatus


class TestJobsListResponse:
    def test_create(self):
        resp = JobsListResponse(jobs=[], total=0)
        assert resp.total == 0
        assert resp.jobs == []

    def test_with_jobs(self):
        job = {"id": "1", "name": "test", "status": "Done", "timestamp": "2024-01-01"}
        resp = JobsListResponse(jobs=[job], total=1)
        assert resp.total == 1


class TestTaskProgressResponse:
    def test_create(self):
        resp = TaskProgressResponse(
            task_id="t1",
            status=GenerationTaskStatus.Generating,
            progress=0.5,
        )
        assert resp.task_id == "t1"
        assert resp.progress == 0.5

    def test_zero_progress(self):
        resp = TaskProgressResponse(
            task_id="t2",
            status=GenerationTaskStatus.Pending,
            progress=0.0,
        )
        assert resp.progress == 0.0


class TestGenerateEntityRequest:
    def test_create_without_country(self):
        req = GenerateEntityRequest(count=5)
        assert req.count == 5

    def test_create_with_country(self):
        req = GenerateEntityRequest(
            count=3,
            country_info={"country_code": "US", "country_name": "United States"},
        )
        assert req.count == 3
