from titan_db.jobs.errors import (
    JobNotFoundError,
    TaskNotFoundError,
    PhaseNotFoundError,
    StoryNotFoundError,
    EntityNotFoundError,
    DBAttributeSerializationError,
    DBAttributeDeserializationError,
    JobManagerDbError,
)


class TestErrors:
    def test_job_not_found(self):
        err = JobNotFoundError(job_id="abc-123")
        assert "abc-123" in str(err)

    def test_task_not_found(self):
        err = TaskNotFoundError(task_id="t-456")
        assert "t-456" in str(err)

    def test_phase_not_found(self):
        err = PhaseNotFoundError(phase="generation", job_id="j1")
        assert "generation" in str(err)

    def test_story_not_found(self):
        err = StoryNotFoundError(story_id="s-789")
        assert "s-789" in str(err)

    def test_entity_not_found(self):
        err = EntityNotFoundError(entity_id="e-321")
        assert "e-321" in str(err)

    def test_serialization_error(self):
        err = DBAttributeSerializationError("bad data")
        assert isinstance(err, Exception)

    def test_deserialization_error(self):
        err = DBAttributeDeserializationError("corrupt")
        assert isinstance(err, Exception)

    def test_job_manager_db_error(self):
        err = JobManagerDbError("generic db error")
        assert isinstance(err, Exception)

    def test_inheritance(self):
        assert issubclass(JobNotFoundError, JobManagerDbError)
        assert issubclass(TaskNotFoundError, JobManagerDbError)
        assert issubclass(StoryNotFoundError, JobManagerDbError)
        assert issubclass(EntityNotFoundError, JobManagerDbError)
        assert issubclass(PhaseNotFoundError, JobManagerDbError)
