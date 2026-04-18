from collections import deque, defaultdict, Counter
from queue import Queue
import threading
from threading import Lock
import itertools
from itertools import repeat
from dataclasses import dataclass
import random
from typing import Iterator, Iterable

from core.appsync_client import AppsyncClient
from titan_db.jobs import db_task_utils
from titan_db.events import db
from titan_db.events.db import GeneratedTaskData
from core.config import SETTINGS
from core.titan_logger import logger
from model.status import GenerationTaskStatus
from generation.simulation.social import SocialContext
from model.job import GenerationJob
from model.tasks import EventTask, GenerationTask, UploadedFileTask
from model.types import GeneratedData, EventType, FILE_EVENT_TYPES, EventData, Location, Chat


client  = AppsyncClient()

class TaskGenerationHub:
    """
        Generates events for a job's tasks including handling any sub-tasks. All Contractors must communicate task
        execution and event retrieval through the job's hub.
    """
    def __init__(self, job: GenerationJob, context: SocialContext):
        self.job = job
        self.context = context
        self._task_queue = self._initialize_task_queue()    # Initialize task queue with job's tasks
        self._completed_task_ids = set()
        self._event_type_to_task_ids = defaultdict(set)     # For maintaining generation order of dependent event types
        self._lock = threading.Lock()                       # Lock for checking and adding to _completed_task_ids
        self._db_writer = GeneratedDataDbWriter(job_id=job.job_id)    # Events buffer queue
        for task in job.tasks:
            self._event_type_to_task_ids[task.event_type].add(task.task_id)

    @property
    def job_id(self):
        return self.job.job_id

    def generate_events(self):
        # Spawn runners to generate tasks concurrently
        task_runners = [threading.Thread(target=self._run_task) for _ in range(SETTINGS.MAX_CONCURRENT_TASKS)]
        for task_runner in task_runners:
            task_runner.start()
        for task_runner in task_runners:
            task_runner.join()

    def get_task_events(self, task_id: str, event_type: EventType) -> Iterator[GeneratedData]:
        # Retrieve task's generated events from DB by its ID
        with self._lock:
            if task_id not in self._completed_task_ids:
                raise Exception(f'Task {task_id} is not yet complete! This code should not be reached.')
        events = db.read_events(job_id=self.job_id, event_type=event_type, task_id=task_id)
        yield from events

    def get_events(self, event_types: set[EventType], sample: int = None) -> Iterator[GeneratedData]:
        #TODO perhaps allow event_types arg to be EventType or Set. Also in db, perhaps add sample arg to read_events()
        if sample:
            yield from db.sample_events(job_id=self.job_id, event_types=event_types, sample=sample)
        else:
            for event_type in event_types:
                yield from db.read_events(job_id=self.job_id, event_type=event_type, include_attachments=False)

    def get_task_locations(self, task: GenerationTask, shuffle: bool = False) -> Iterator[Location | None]:
        location_allocation = self.context.get_location_allocation(task_id=task.task_id)
        if location_allocation is None:
            yield from repeat(None, times=task.quantity)
            return
        locations_iter = db.read_locations_by_id_range(job_id=self.job_id, first_id=location_allocation.first_id,
                                                       last_id=location_allocation.last_id)
        remainder = task.quantity - location_allocation.num_locations
        if not shuffle or not remainder:
            yield from locations_iter
            yield from repeat(None, times=remainder)
        else:
            none_idxs = set(random.sample(range(task.quantity), k=remainder))
            for idx in range(task.quantity):
                if idx in none_idxs:
                    yield None
                else:
                    yield next(locations_iter)

    def get_task_location_ids(self, task: GenerationTask) -> Iterator[str | None]:
        location_allocation = self.context.get_location_allocation(task_id=task.task_id)
        if location_allocation is None:
            yield from repeat(None, times=task.quantity)
        else:
            yield from location_allocation
            yield from repeat(None, times=task.quantity - location_allocation.num_locations)

    def save_events(self, events: Iterable[GeneratedData]) -> None:
        """
            Special method to allow persisting of events at DB.
            These events will be set with `is_sub_event` attribute set to `True`.
        """
        def set_is_sub_event(event: GeneratedData) -> GeneratedData:
            event.is_sub_event = True
            return event
        events = map(set_is_sub_event, events)
        db.write_events(job_id=self.job_id, events=events)

    @dataclass(frozen=True)
    class QueuedTask:
        task: GenerationTask
        subtask_ids: set[str]

    def _initialize_task_queue(self) -> deque:
        def _get_all_sub_queued_tasks(task: GenerationTask) -> Iterator[TaskGenerationHub.QueuedTask]:
            sub_tasks = list(task.get_sub_tasks())
            queued_task = TaskGenerationHub.QueuedTask(
                task=task,
                subtask_ids={sub_task.task_id for sub_task in sub_tasks}
            )
            yield queued_task
            for sub_task in sub_tasks:
                if isinstance(sub_task, EventTask):     # Assign sub_task with parent task app_id if not file event
                    sub_task.app_id = task.app_id
                yield from _get_all_sub_queued_tasks(sub_task)

        queued_tasks = itertools.chain.from_iterable(map(_get_all_sub_queued_tasks, self.job.tasks))
        queued_tasks = sorted(
            queued_tasks,
            key=lambda qt: not (qt.task.event_type is EventType.APP or qt.task.event_type in FILE_EVENT_TYPES))
        task_queue = deque(queued_tasks)

        return task_queue

    def _run_task(self):
        while True:
            try:
                # Retrieve task from queue
                queued_task = self._task_queue.popleft()

                # Verify task's sub-tasks are complete
                if queued_task.subtask_ids:     # Task has sub-tasks
                    with self._lock:
                        if any(subtask_id not in self._completed_task_ids for subtask_id in queued_task.subtask_ids):
                            # Found sub-task which has not yet been completed
                            self._task_queue.append(queued_task)    # Re-insert task back onto end of queue
                            continue

                # Verify tasks whose event types are required for queued_task to execute are complete
                event_type_dependencies = _event_type_to_dependencies[queued_task.task.event_type]
                dependent_task_ids = {task_id
                                      for event_type in event_type_dependencies
                                      for task_id in self._event_type_to_task_ids[event_type]}
                if dependent_task_ids:
                    with self._lock:
                        if any(task_id not in self._completed_task_ids for task_id in dependent_task_ids):
                            self._task_queue.append(queued_task)  # Re-insert task back onto end of queue
                            continue

                # Generate task events
                self._generate_task(task=queued_task.task)

                # Update list of completed task IDs
                with self._lock:
                    self._completed_task_ids.add(queued_task.task.task_id)
            except IndexError:  # Task queue is empty, no more tasks to process
                break
            except Exception as e:
                logger.error(f'Error in task generation hub thread: [{type(e).__name__}] {e}',
                                        job_id=self.job_id)
                raise e

    def _generate_task(self, task: GenerationTask) -> None:
        logger.info(
            f"Generating task (job_id={self.job_id}, task_id={task.task_id}, event_type={task.event_type})",
            job_id=self.job_id, task_id=task.task_id, event_type=task.event_type
        )
        self._update_task_status(task=task, status=GenerationTaskStatus.Generating)

        count = 0   # =0, safety net in case there are no events or errors
        progress_updated_batch = 0
        # Determine update task count progress (maximum 1% of requested quantity)
        progress_update_frequency = max(SETTINGS.TASK_PROGRESS_UPDATE_EVENT_FREQUENCY, task.quantity // 100)
        try:
            # Generate and write task's events
            task_events = self._generate_task_events(task=task)
            if task.event_type is EventType.CHAT:
                # Fix count: for Chat events, count is the number of messages
                count_task_events_iter = self._ChatMessageCountIterator(task_events)
            else:
                count_task_events_iter = enumerate(task_events, 1)
            for count, data in count_task_events_iter:
                task_data = GeneratedTaskData(data=data, task_id=task.task_id)
                num_flushed_task_events = self._db_writer.write(task_data)  # Write event to DB queue
                # Update task status periodically
                current_progress_batch = num_flushed_task_events // progress_update_frequency
                if current_progress_batch > progress_updated_batch:
                    self._update_task_count(task=task, count=num_flushed_task_events)
                    progress_updated_batch = current_progress_batch
            self._db_writer.flush()
        except Exception as e:
            logger.exception(f'Failed to generate task: {e}', job_id=self.job_id, error=e)
            self._db_writer.flush()
            self._update_task_count(task=task, count=self._db_writer.task_event_counter[task.task_id])
            self._update_task_status(task=task, status=GenerationTaskStatus.Failed)
            return

        # Update task status
        logger.info(
            f"Generated task (job_id={self.job_id}, task_id={task.task_id}, event_type={task.event_type})",
            job_id=self.job_id, task_id=task.task_id, event_type=task.event_type
        )
        self._update_task_count(task=task, count=count)
        self._update_task_status(task=task, status=GenerationTaskStatus.Done)

    def _generate_task_events(self, task: GenerationTask) -> Iterator[GeneratedData]:
        if isinstance(task, UploadedFileTask):
            from generation.simulation.events.contractors.uploads import UploadedFileContractor
            architect = None
            contractor = UploadedFileContractor(hub=self, job=self.job, task=task)
        else:
            from generation import foreman
            architect = foreman.hire_architect(event_type=task.event_type, context=self.context)
            contractor = foreman.hire_contractor(event_type=task.event_type, hub=self, task=task)

        if architect is not None:
            blueprints = architect.create_blueprints(n=task.quantity, params=task)
            task_events = contractor.construct(blueprints=blueprints)
        else:
            task_events = contractor.construct()

        if task.is_sub_task:
            def set_is_attachment(event: GeneratedData) -> GeneratedData:
                event.is_attachment = True
                return event
            task_events = map(set_is_attachment, task_events)

        # Enrich task events with apps. Ensure events are not file events or apps so they can be assigned an app_uid.
        if isinstance(task, EventTask) and task.event_type is not EventType.APP:
            task_events = self._enrich_task_events_with_apps(task=task, events=task_events)

        return task_events

    def _enrich_task_events_with_apps(self, task: EventTask, events: Iterator[EventData]) -> Iterator[EventData]:
        if task.app_id:  # Params object guaranteed to have "app_id" attr (subclass of EventTask)
            app = db.read_app_by_appid(job_id=self.job_id, app_id=task.app_id)
            if app is None:     # ERROR: can't find user's custom app, so return the same iterator
                logger.warn(f"Could not find task's custom app (app_id={task.app_id}) in DB", app_id=task.app_id)
                yield from events
                return
            apps_iter = repeat(app, times=task.quantity)
        else:
            apps = db.get_random_apps_by_event_type(job_id=self.job_id, event_type=task.event_type, sample=task.quantity)
            if not apps:    # No apps were generated that have this task's event type, so return the same iterator
                yield from events
                return
            apps_iter = (random.choice(apps) for _ in range(task.quantity))

        # Enrich event with its app UID reference
        for event, app in zip(events, apps_iter):
            event.app_uid = app.uid
            yield event
    
    def _update_task_status(self, task: GenerationTask, status: GenerationTaskStatus):
        db_task = db_task_utils.get_generation_task(task_id=task.task_id)
        requested_count = db_task.requested_count
        
        match status:
            case GenerationTaskStatus.Generating:
                # Covers case where job contains no generated events (e.g., uploaded files)
                if requested_count:
                    _emit_task_status(job_id=self.job_id, task_id=task.task_id, status=status)
                return db_task_utils.update_generation_task_status(task_id=task.task_id, status=status)
            case GenerationTaskStatus.Done:
                final_count = db_task.final_count or "N/A"
                if requested_count and requested_count != final_count:  # If generator didn't generate the requested amount
                    _emit_task_status(job_id=self.job_id, task_id=task.task_id, status=GenerationTaskStatus.Partial, final_count=final_count)
                    return db_task_utils.update_generation_task_status(task_id=task.task_id, status=GenerationTaskStatus.Partial)
                
                _emit_task_status(job_id=self.job_id, task_id=task.task_id, status=status, final_count=final_count)
                return db_task_utils.update_generation_task_status(task_id=task.task_id, status=status)
            case _:
                _emit_task_status(job_id=self.job_id, task_id=task.task_id, status=status)
                return db_task_utils.update_generation_task_status(task_id=task.task_id, status=status)
    
    def _update_task_count(self, task: GenerationTask, count: int) -> None:
        db_task = db_task_utils.get_generation_task(task_id=task.task_id)
        current_count = db_task.final_count or 0
        if count > current_count:  # Update count only if it's higher than the current count
            db_task_utils.update_generation_task_final_count(task_id=task.task_id, count=count)
            _emit_task_status(job_id=self.job_id, task_id=task.task_id, final_count=count, status=GenerationTaskStatus.Generating)

    class _ChatMessageCountIterator:
        """Helper iterator to adjust the count of Chat (messages) for updating task's "Done" status"""
        def __init__(self, chats: Iterator[Chat]):
            self._it = chats
            self.count = 0

        def __iter__(self):
            return self

        def __next__(self) -> tuple[int, Chat]:
            chat = next(self._it)
            self.count += len(chat.messages)
            return self.count, chat


# This is a mapping from an event type (registered to some contractor) to a set of all the event types (contractors)
#   that the corresponding contractor is recursively dependent upon for generating its data.
class GeneratedDataDbWriter:
    def __init__(self, job_id: str):
        super().__init__()
        self.job_id = job_id
        self._weight = 0                # Weight of events in queue (1 for each event or each message in Chat)
        self._queue = Queue()           # Queue of GeneratedTaskData event objects waiting to be written to DB
        self._lock = Lock()             # Event queue lock
        self.task_event_counter = Counter()    # Counter of events written per task

    def write(self, task_data: GeneratedTaskData) -> int:
        with self._lock:
            self._queue.put(task_data)
            self._weight += self._get_weight(task_data.data)
            if self._weight >= SETTINGS.MAX_GENERATED_DATA_DB_BUFFER_SIZE:
                data_size_message = f'{self._queue.qsize()} events'
                if self._queue.qsize() != self._weight:
                    data_size_message += f', weight={self._weight}'
                logger.debug(f'Flushing overflowed queue ({data_size_message}) to DB (job_id={self.job_id})', data_size_message=data_size_message)
                self._flush()
            num_flushed_task_events = self.task_event_counter.get(task_data.task_id, 0)
            return num_flushed_task_events

    def flush(self):
        with self._lock:
            if not self._queue.empty():
                logger.debug(f'Flushing queue ({self._queue.qsize()} events) to DB (job_id={self.job_id})', data_size=self._queue.qsize())
                self._flush()

    def _flush(self):
        db.write_task_events(job_id=self.job_id, events=self._queue.queue)
        # Clear queue and count events written per task
        self.task_event_counter.update(
            self._queue.get().task_id
            for _ in range(self._queue.qsize())
        )
        if not self._queue.empty():
            raise Exception(f'Queue was not empty after flushing (size={self._queue.qsize()})')
        self._weight = 0    # Reset weight

    @classmethod
    def _get_weight(cls, data: GeneratedData) -> int:
        weight = 1
        for attr_model in data.foreign_fields:
            attr_data = getattr(data, attr_model)
            if attr_data:
                if isinstance(attr_data, list):
                    weight += sum(map(cls._get_weight, attr_data))
                else:
                    weight += cls._get_weight(attr_data)
        return weight


_event_type_to_dependencies: dict[EventType, set[EventType]] = {}


def _create_event_type_dependencies_map() -> None:
    from generation.simulation.events.contractors.registry import contractor_registry

    def _get_all_dependencies(event_type: EventType, visited: list[EventType] = None) -> set[EventType]:
        visited = visited or []   # top level call (from outer for loop)
        if event_type in visited:
            raise Exception(f"Found cycle in {event_type.name} contractor's event type dependency graph: "
                            f"{'-->'.join(et.name for et in visited)}")
        if event_type in _event_type_to_dependencies:   # small optimization
            return _event_type_to_dependencies[event_type]
        visited.append(event_type)
        direct_dependencies = contractor_registry[event_type].event_type_dependencies
        dependencies = set(direct_dependencies)
        for dep in direct_dependencies:
            dependencies.update(_get_all_dependencies(event_type=dep, visited=visited))
        visited.pop()
        return dependencies

    for event_type, contractor_class in contractor_registry.items():
        _event_type_to_dependencies[event_type] = _get_all_dependencies(event_type=event_type)


_create_event_type_dependencies_map()


def _emit_task_status(job_id: str, task_id: str, status: GenerationTaskStatus, final_count: int | None = None):
    event = {
        "task_id": task_id,
        "status": status,
    }
    if final_count is not None:
        event["final_count"] = final_count
    client.publish_event(
        events=[event],
        channel=f"{job_id}-tasks"
    )
