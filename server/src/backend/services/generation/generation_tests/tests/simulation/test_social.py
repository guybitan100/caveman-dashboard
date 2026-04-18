import json
import unittest

from generation.simulation.social import LocationIdAllocation
from model.types import EventType


class TestTotalLocations(unittest.TestCase):

    def setUp(self):
        self.location_allocation = LocationIdAllocation(
            event_type=EventType.CALL,
            base_idx=1,
            num_locations=3,
            loc_task_id_to_range={}
        )

    def test_dict(self):
        expected_dict = {
            'event_type': EventType.CALL.value,
            'base_idx': 1,
            'num_locations': 3,
            'loc_task_id_to_range': {}
        }
        assert json.loads(self.location_allocation.model_dump_json()) == expected_dict

    def test_iterated_location_ids(self):
        expected_ids = [
            '00000001-0000-0000-0000-000000000000',
            '00000001-0000-0000-0000-000000000001',
            '00000001-0000-0000-0000-000000000002'
        ]
        assert list(self.location_allocation) == expected_ids

    def test_empty_location_ids(self):
        location_allocation = LocationIdAllocation(
            event_type=EventType.CALL,
            base_idx=1,
            num_locations=0,
            loc_task_id_to_range={}
        )
        expected_ids = []
        assert list(location_allocation) == expected_ids

    def test_first_id(self):
        expected_id = '00000001-0000-0000-0000-000000000000'
        assert self.location_allocation.first_id == expected_id

    def test_last_id(self):
        expected_id = '00000001-0000-0000-0000-000000000002'
        assert self.location_allocation.last_id == expected_id

    def test_validate_loc_idx_range_totals_lte_num_locations(self):
        with self.assertRaises(Exception):
            LocationIdAllocation(
                event_type=EventType.CALL,
                base_idx=1,
                num_locations=3,
                loc_task_id_to_range={
                    'task_id': (0, 5)
                }
            )
