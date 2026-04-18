from collections import Counter
from enum import Enum
from itertools import repeat, islice
import random
from abc import ABC, abstractmethod
from typing import ClassVar, Iterator, Sequence, Any, Callable

from generation.simulation.hub import TaskGenerationHub
from generation.simulation.utils import FileDeletedState
from model.job import GenerationJob
from model.tasks import EventTask, FileTask, GenerationTask
from model.types import GeneratedData, EventData, FileData, EventType, Location, Coordinate


class Contractor[GT: GenerationTask, GD: GeneratedData](ABC):
    """
    Abstract class for all Titan contractors.

    Attributes:
        hub:        Job hub, if not passed then the job arg is required
        job:        Generation job the contractor will process.
        task:       Generation task the contractor will process
    """
    event_type_dependencies: ClassVar[set[EventType]]   # Dependent event types, set on registration

    def __init__(self, *, hub: TaskGenerationHub = None, job: GenerationJob = None, task: GT = None):
        if hub is None and job is None:
            raise Exception("Contractor must be assigned either a hub or job")
        self.hub = hub
        self.job = hub.job if hub is not None else job
        if hub is not None:
            self.context = hub.context
        self.task = task

    @abstractmethod
    def construct(self, *args, **kwargs) -> Iterator[GD]:
        raise NotImplementedError

    @property
    def quantity(self) -> int:
        return self.task.quantity

    @staticmethod
    def _repeat_func(n: int, func: Callable, *func_args, **func_kwargs) -> Iterator:
        return (func(*func_args, **func_kwargs) for _ in range(n))

    @staticmethod
    def _random_choices(
            n: int,
            values: Sequence[Any],
            *,
            weights: Sequence[float] | None = None,
            none_weight: float = None
    ) -> Iterator[Any | None]:
        if weights is not None:
            assert len(values) == len(weights)

        if none_weight is not None:
            assert 0 <= none_weight <= 1
            if weights is None:
                weights = ((1-none_weight) / len(values),) * len(values)
            values = (*values, None)
            weights = (*weights, none_weight)

        if not weights:
            yield from Contractor._repeat_func(n, random.choice, values)
        else:
            for choice in Contractor._repeat_func(n, random.choices, values, weights=weights):
                yield choice[0]

    @staticmethod
    def _random_enum_choices[E: Enum](
        n: int,
        enum: type[E],
        *,
        weights: tuple[float, ...] | None = None,
        none_weight: float = None
    ) -> Iterator[E | None]:
        return Contractor._random_choices(n, tuple(enum), weights=weights, none_weight=none_weight)

    @staticmethod
    def _random_boolean_choices(n: int, true_prob: float = 0.5) -> Iterator[bool]:
        return Contractor._random_choices(n, (True, False), weights=(true_prob, 1 - true_prob))

    @staticmethod
    def _random_range_choices(n: int, low: int, high: int, none_weight: float = None) -> Iterator[int | None]:
        """Random integer (or None) generator from low to high (inclusive)"""
        if high == 0:
            return repeat(None, times=n)
        elif none_weight is None:
            return Contractor._repeat_func(n, random.randint, low, high)
        else:
            return Contractor._random_choices(n, range(low, high + 1), none_weight=none_weight)

    def _create_coordinate_from_location(self, location: Location | None) -> Coordinate | None:
        return Coordinate(lat=location.latitude, lon=location.longitude) if location else None


class EventContractor[ET: EventTask, ED: EventData](Contractor[ET, ED], ABC):
    """Event contractor abstract class."""

    def _get_attachments(
            self,
            attachments_params: list[GenerationTask] | None,
            attachments_prob: float,
            event_dependencies: set[EventType],
            quantity: int | None = None
    ) -> Iterator[tuple[GeneratedData]]:
        if quantity is None:
            quantity = self.quantity

        if attachments_params:
            total_attachments = sum(task.quantity for task in attachments_params)
            attachments = (
                file_data
                for task in attachments_params
                for file_data in self.hub.get_task_events(task_id=task.task_id, event_type=task.event_type)
            )
        else:
            total_attachments = sum(self._random_boolean_choices(quantity, true_prob=attachments_prob))
            attachments = self.hub.get_events(event_types=event_dependencies, sample=total_attachments)

        event_idx_to_attachment_count = Counter(random.choices(range(quantity), k=total_attachments))
        for idx in range(quantity):
            yield tuple(islice(attachments, 0, event_idx_to_attachment_count[idx]))


class FileContractor[FT: FileTask, FD: FileData](Contractor[FT, FD], ABC):
    """File contractor abstract class."""

    @staticmethod
    def _random_deleted_states(n: int) -> Iterator[FileDeletedState]:
        return Contractor._random_enum_choices(n, FileDeletedState, weights=(0.9, 0.03, 0.02, 0.05))
