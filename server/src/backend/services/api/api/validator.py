from metafinder_client.client import MetaFinderClient
from metafinder_client.utils import map_event_to_metafinder_type
from model.tasks import ValidationResult, GenerationTask
from model.status import ValidationStatus


def validate_task(task: GenerationTask, metafinder_client: MetaFinderClient) -> ValidationResult:
    try:
        metafinder_event_type = map_event_to_metafinder_type(task.event_type)
    except ValueError:
        return ValidationResult(status=ValidationStatus.Success, count=task.quantity)

    count = metafinder_client.get_count(data_type=metafinder_event_type, **task.model_dump())

    if count == 0:
        return ValidationResult(status=ValidationStatus.Failure, count=0)

    if count < task.quantity:
        return ValidationResult(status=ValidationStatus.PartialSucces, count=count)

    return ValidationResult(status=ValidationStatus.Success, count=count)
