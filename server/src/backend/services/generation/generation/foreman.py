from generation.simulation.events.architects.architect import Architect
from generation.simulation.events.architects.registry import architect_registry
from generation.simulation.events.contractors.contractor import Contractor
from generation.simulation.events.contractors.registry import contractor_registry
from generation.simulation.hub import TaskGenerationHub
from generation.simulation.social import SocialContext
from model.job import GenerationJob
from model.tasks import GenerationTask
from model.types import EventType


def hire_contractor(
        event_type: EventType,
        hub: TaskGenerationHub = None,
        job: GenerationJob = None,
        task: GenerationTask = None
) -> Contractor:
    contractor_class = contractor_registry.get(event_type)
    if contractor_class is None:
        raise Exception(f"No registered contractor for event type {event_type}")
    contractor = contractor_class(hub=hub, job=job, task=task)
    return contractor


def hire_architect(event_type: EventType, context: SocialContext) -> Architect | None:
    architect_class = architect_registry.get(event_type)
    if architect_class is None:
        return None
    architect = architect_class(context=context)
    return architect
