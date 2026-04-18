class DBAttributeSerializationError(Exception):
    """
    Custom exception for attribute serialization errors
    """
    pass


class DBAttributeDeserializationError(Exception):
    """
    Custom exception for attribute deserialization errors
    """
    pass


class JobManagerDbError(Exception):
    pass


class JobNotFoundError(JobManagerDbError):
    def __init__(self, job_id: str):
        message = f'Could not find job in DB ({job_id=})'
        super().__init__(message)


class TaskNotFoundError(JobManagerDbError):
    def __init__(self, task_id: str):
        message = f'Could not find task in DB ({task_id=})'
        super().__init__(message)


class PhaseNotFoundError(JobManagerDbError):
    def __init__(self, **kwargs):
        message = f'Could not find phase in DB ({kwargs})'
        super().__init__(message)


class StoryNotFoundError(JobManagerDbError):
    def __init__(self, story_id: str):
        message = f'Could not find story in DB ({story_id=})'
        super().__init__(message)


class EntityNotFoundError(JobManagerDbError):
    def __init__(self, entity_id: str):
        message = f'Could not find entity in DB ({entity_id=})'
        super().__init__(message)
