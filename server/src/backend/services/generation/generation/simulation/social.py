import random
from collections import Counter
from typing import Iterator

from pydantic import BaseModel, field_validator, ValidationInfo

from core.titan_logger import logger
from generation.simulation.entities import get_entity_total
from model.job import GenerationJob
from model.tasks import GenerationTask, LocationTask
from model.types import Entity, EntityID, EventType
from simulation_utils.entities import generate_entities

MIN_ENTITY_WEIGHT = 0.00001
MAX_ENTITIES = 100_000


class LocationIdAllocation(BaseModel):
    event_type: EventType   # Task event type (needed by LocationContractor)
    base_idx: int           # UUID: "<base_idx 0-padded up to 8>-0000-0000-0000-<num_locations 0-padded up to 12>"
    num_locations: int      # Total locations allocated for a task

    # Location task_id to indices sub-range of the task's IDs that the Location task's contractor should construct
    #   {loc_task_id: (start_idx, end_idx)}
    loc_task_id_to_range: dict[str, tuple[int, int]]

    @field_validator('loc_task_id_to_range')
    def validate_loc_idx_range_totals_lte_num_locations(cls, loc_task_id_to_range: dict[str, tuple[int, int]], validation_info: ValidationInfo):
        values = validation_info.data
        idx_range_totals = sum(end_idx - start_idx for start_idx, end_idx in loc_task_id_to_range.values())
        if idx_range_totals > values['num_locations']:
            raise Exception(f'Total locations assigned to location tasks {idx_range_totals} exceeds allocated task '
                            f'locations {values["num_locations"]}')
        return loc_task_id_to_range

    def __iter__(self) -> Iterator[str]:
        it = iter(self._create_id(idx=idx) for idx in range(self.num_locations))
        return it

    def __getitem__(self, idx_slice) -> Iterator[str]:
        assert isinstance(idx_slice, slice) \
               and idx_slice.start is not None \
               and idx_slice.stop is not None \
               and idx_slice.step is None \
               and (0 <= idx_slice.start < self.num_locations) \
               and (idx_slice.start < idx_slice.stop <= self.num_locations), \
            (f'Invalid index slice {idx_slice} for location allocation (event_type={self.event_type}, '
             f'base_idx={self.base_idx}, num_locations={self.num_locations})')
        it = iter(self._create_id(idx=idx) for idx in range(idx_slice.start, idx_slice.stop))
        return it

    def _create_id(self, idx: int) -> str:
        return f'{self.base_idx:08}-0000-0000-0000-{idx:012}'

    @property
    def first_id(self) -> str:
        return self._create_id(0)

    @property
    def last_id(self) -> str:
        return self._create_id(self.num_locations-1)


class SocialContext:
    def __init__(
            self,
            owner_entity: Entity,
            entities: list[Entity],
            weights: list[float] | None,
            location_allocations: dict[str, LocationIdAllocation]
    ):
        if weights is not None and len(entities) != len(weights):
            raise Exception(f'Weights ({len(weights)}) must have same size as entities ({len(entities)})')

        self.owner_entity = owner_entity  # Entity representing device owner
        self.entities = entities  # All other entities that can interact with device owner
        self._entities = {entity.uid: entity for entity in self.entities}
        self._entities[self.owner_entity.uid] = self.owner_entity

        self.weights = weights  # Probability weights of sampling each entity for event participation

        self.location_allocations = location_allocations   # Task ID to location ID allocation info

    def __getitem__(self, entity_id: EntityID) -> Entity:
        return self._entities[entity_id]

    def get_random_entities(self, n: int, unique: bool = False) -> list[Entity]:
        if n == 0:
            return []

        if not unique:
            return random.choices(self.entities, k=n, weights=self.weights)

        if n > len(self.entities):
            logger.debug(f'Requested {n} unique entities, but limiting to {len(self.entities)}', n=n)
            n = len(self.entities)

        if n == len(self.entities):
            shuffled_entities = self.entities.copy()
            random.shuffle(shuffled_entities)
            return shuffled_entities

        entity_idxs = random.choices(range(len(self.entities)), k=n, weights=self.weights)
        unique_idxs = dict.fromkeys(entity_idxs)    # maintains order of insertion (same order of random choices)
        if len(unique_idxs) < n:                    # check if all choices were unique
            curr_weights = self.weights.copy()
            while len(unique_idxs) < n:
                for idx in unique_idxs:
                    curr_weights[idx] = 0           # omit already chosen entities by zeroing its probability weight
                remaining_idxs = random.choices(range(len(self.entities)), k=n-len(unique_idxs), weights=curr_weights)
                unique_idxs.update(dict.fromkeys(remaining_idxs))
        return [self.entities[idx] for idx in unique_idxs]

    def get_location_allocation(self, task_id: str) -> LocationIdAllocation | None:
        return self.location_allocations.get(task_id)


def _allocate_locations_to_tasks(tasks: list[GenerationTask]) -> dict[str, LocationIdAllocation]:
    # Filter locations tasks without category
    # We filter out location tasks in which the user specified a category because we don't want to assume other
    #  tasks types that such Location events should be assigned to.
    location_tasks = [t for t in tasks if isinstance(t, LocationTask) and not t.category]
    if not location_tasks:
        return {}

    # Filter all other tasks that are not location related
    ignored_event_types = {EventType.LOCATION, EventType.JOURNEY}
    tasks = [       # Flatten all tasks and their sub_tasks
        task
        for task in tasks
        for flat_task in task.flatten_tasks()   # returns the task itself in the iterator
        if flat_task.event_type not in ignored_event_types
    ]
    if not tasks:
        return {}   # No other tasks to assign locations to

    # Determine the total amount of locations to distribute
    total_locations = sum(task.quantity for task in location_tasks)     # Total locations to distribute
    task_quantities = [task.quantity for task in tasks]                 # List of quantities of all tasks
    total_locations = min(total_locations, sum(task_quantities))        # Limit total locations to task quantities sum

    # Randomly distribute total_locations among tasks weighted by their quantities
    task_id_to_num_locations = Counter(
        random.sample([task.task_id for task in tasks], k=total_locations, counts=task_quantities))

    # Distribute the locations among the location tasks
    task_id_to_location_allocation = {}
    loc_task_id_to_quota = {task.task_id: task.quantity for task in location_tasks}     # Initialize quotas
    for base_idx, task in enumerate(tasks, 1):
        num_task_locations = task_id_to_num_locations.get(task.task_id)         # Retrieve # locations assigned to task
        if not num_task_locations:
            continue    # No locations assigned to this task
        # Distribute the task's assigned # locations from the location tasks remaining quota
        total_quota_remainder = sum(loc_task_id_to_quota.values())
        if not total_quota_remainder:
            break   # No more remaining location quota to assign
        num_task_locations = min(num_task_locations, total_quota_remainder)     # Limit to total remaining quota
        # Randomly select quota from location tasks to assign to this task
        loc_task_id_to_task_locations = Counter(
            random.sample(tuple(loc_task_id_to_quota), k=num_task_locations, counts=loc_task_id_to_quota.values()))
        # Construct lookup from location task ID to the index range within the LocationIdAllocation it's assigned to
        start_idx = 0
        loc_task_id_to_range = {}
        for loc_task_id, num_locations in loc_task_id_to_task_locations.items():
            end_idx = start_idx + num_locations
            loc_task_id_to_range[loc_task_id] = (start_idx, end_idx)
            start_idx = end_idx
            loc_task_id_to_quota[loc_task_id] -= num_locations  # Deduct assigned locations from location task quota
        # Construct Location allocation for this task
        task_id_to_location_allocation[task.task_id] = LocationIdAllocation(
            event_type=task.event_type,
            base_idx=base_idx,
            num_locations=loc_task_id_to_task_locations.total(),
            loc_task_id_to_range=loc_task_id_to_range
        )

    return task_id_to_location_allocation


def initialize_social_context(job: GenerationJob) -> SocialContext:
    logger.debug('Generating entities...')
    total_entities = get_entity_total(tasks=job.tasks)
    total_entities = min(total_entities, MAX_ENTITIES)      # limit max entities that can be created
    total_entities -= len(job.entities)   # subtract entities given by the user
    total_entities = max(0, total_entities)     # handle case where random total entities is less than total given
    entities = generate_entities(n=total_entities, country_info=job.context.country_info)
    entities += job.entities              # Concatenate extra entities given by user

    logger.debug('Allocating location to tasks...')
    location_allocations = _allocate_locations_to_tasks(tasks=job.tasks)

    logger.debug('Generating social context connections...')
    # Create entity weights
    weights = _generate_social_context_entity_weights(num_weights=len(entities))
    # Generate owner's social circle
    context = SocialContext(
        owner_entity=job.owner_entity,
        entities=entities,
        weights=weights,
        location_allocations=location_allocations
    )

    return context


def _generate_social_context_entity_weights(num_weights: int) -> list[float]:
    if num_weights == 0:
        return []

    weights = [random.uniform(MIN_ENTITY_WEIGHT, 1.0) for _ in range(num_weights)]
    weights_sum = sum(weights)
    weights = [w / weights_sum for w in weights]

    return weights
