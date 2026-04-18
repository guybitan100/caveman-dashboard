import unittest
from collections import defaultdict
from unittest.mock import patch, call

import pytest

from core.config import SETTINGS
from model.types import EventType


@pytest.mark.usefixtures("c_hub")
class TestTaskGenerationHub(unittest.TestCase):

    def test_init(self):
        expected_event_type_to_task_ids = defaultdict(set)
        for task in self.hub.job.tasks:
            expected_event_type_to_task_ids[task.event_type].add(task.task_id)
        # Assert that the instance variables are set correctly
        self.assertEqual(self.hub._task_queue, self.hub._initialize_task_queue())
        self.assertEqual(self.hub._completed_task_ids, {'task_1'})
        self.assertEqual(self.hub._event_type_to_task_ids, expected_event_type_to_task_ids)

        # Assert that the _event_type_to_task_ids dictionary is correctly populated
        for task in self.hub.job.tasks:
            self.assertIn(task.task_id, self.hub._event_type_to_task_ids[task.event_type])

    @patch('threading.Thread')
    def test_generate_events_MAX_CONCURRENT_TASKS_is_3(self, mock_thread):
        # Set the MAX_CONCURRENT_TASKS setting to 3
        SETTINGS.MAX_CONCURRENT_TASKS = 3

        # Call the generate_events method
        self.hub.generate_events()

        # Assert that the correct number of threads are created
        filtered_calls = list(filter(lambda c: c == call(target=self.hub._run_task), mock_thread.call_args_list))
        assert len(filtered_calls) == 3

    @patch('threading.Thread')
    def test_generate_events_MAX_CONCURRENT_TASKS_is_1(self, mock_thread):
        # Set the MAX_CONCURRENT_TASKS setting to 1
        SETTINGS.MAX_CONCURRENT_TASKS = 1

        # Call the generate_events method
        self.hub.generate_events()

        # Assert that the correct number of threads are created
        filtered_calls = list(filter(lambda c: c == call(target=self.hub._run_task), mock_thread.call_args_list))
        assert len(filtered_calls) == 1

    @patch('threading.Lock')
    @patch('titan_db.events.db.read_events')
    def test_get_task_events(self, mock_db, mock_lock):
        # Set up the mock db object to return a list of events when read_events is called
        mock_db.return_value = [
            {'event_type': EventType.APP, 'data': 'This is a test app'}
        ]

        # Add a task to the _completed_task_ids set
        self.hub._completed_task_ids.add('task_1')

        # Call the get_task_events method with the task ID and event type
        events = list(self.hub.get_task_events('task_1', EventType.APP))

        # Assert that the correct events are returned
        self.assertEqual(events, [{'event_type': EventType.APP, 'data': 'This is a test app'}])

        # Assert that the read_events method is called with the correct arguments
        mock_db.assert_called_with(job_id=self.hub.job_id, event_type=EventType.APP, task_id='task_1')

    def test_get_task_events_incomplete_task(self):
        # Add a task to the _completed_task_ids set
        self.hub._completed_task_ids.add('task_1')

        # Call the get_task_events method with a task ID that is not in the _completed_task_ids set
        with self.assertRaises(Exception) as context:
            next(self.hub.get_task_events('task_2', EventType.CHAT))

        # Assert that the correct exception message is raised
        self.assertEqual(str(context.exception), 'Task task_2 is not yet complete! This code should not be reached.')

