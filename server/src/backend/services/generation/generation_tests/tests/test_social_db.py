import unittest
from typing import Iterator
from unittest.mock import patch, call, Mock

import boto3
import numpy as np
from moto import mock_aws

from core.config import SETTINGS
from model.types import Entity


@mock_aws
class TestDB(unittest.TestCase):
    def setUp(self):
        self.client = boto3.client('s3')
        self.client.create_bucket(Bucket=SETTINGS.S3_TITAN_BUCKET_NAME)

    @patch('titan_db.events.db.MongoClient')
    @patch('numpy.array_split', wraps=np.array_split)
    def test_write_social_context(self, mock_array_split, mock_mongo_client):
        from generation.simulation.social import SocialContext
        from generation.social_db import write_social_context, serialize
        with patch('generation.social_db.serialize', wraps=serialize) as serialize_mock:
            mock_collection = Mock()
            mock_mongo_client.return_value.__enter__.return_value.__getitem__.return_value.__getitem__.return_value = mock_collection

            def collection_insert_many_side_effect(data_iter: Iterator[dict]) -> None:
                list(data_iter)     # exhaust iterator

            mock_collection.insert_many.side_effect = collection_insert_many_side_effect

            job_id = 'test'
            owner_entity = Entity(uid='owner_entity', first_name='owner', email='owner@test.com', phone='1234567890')
            entities = [
                Entity(uid='entity1', first_name='entity1', email='entity1@test.com', phone='1234567890'),
                Entity(uid='entity2', first_name='entity2', email='entity2@test.com', phone='1234567890')
            ]
            weights = [0.5, 0.5]
            location_allocations = {}
            social_context = SocialContext(
                owner_entity=owner_entity,
                entities=entities,
                weights=weights,
                location_allocations=location_allocations
            )

            write_social_context(job_id=job_id, social_context=social_context)

            self.assertEqual(serialize_mock.call_args_list,
                              [call(owner_entity), *(call(entity) for entity in entities)])
            self.assertEqual(mock_collection.insert_many.call_count, 2)
            mock_collection.insert_one.assert_called_once()
            mock_array_split.assert_called_once_with([0.5, 0.5], 1)

    @patch('titan_db.events.db.MongoClient')
    @patch('numpy.array_split', wraps=np.array_split)
    def test_write_social_context_no_entities(self, mock_array_split, mock_mongo_client):
        from generation.simulation.social import SocialContext
        from generation.social_db import write_social_context, serialize
        with patch('generation.social_db.serialize', wraps=serialize) as serialize_mock:
            mock_collection = Mock()
            mock_mongo_client.return_value.__enter__.return_value.__getitem__.return_value.__getitem__.return_value = mock_collection

            def collection_insert_many_side_effect(data_iter: Iterator[dict]) -> None:
                list(data_iter)     # exhaust iterator

            mock_collection.insert_many.side_effect = collection_insert_many_side_effect

            job_id = 'test'
            owner_entity = Entity(first_name='owner', email='owner@test.com', phone='1234567890')
            entities = []
            weights = []
            location_allocations = {}
            social_context = SocialContext(
                owner_entity=owner_entity,
                entities=entities,
                weights=weights,
                location_allocations=location_allocations
            )

            write_social_context(job_id=job_id, social_context=social_context)

            assert serialize_mock.mock_calls == [call(owner_entity), *(call(entity) for entity in entities)]
            self.assertEqual(serialize_mock.call_args_list,
                              [call(owner_entity), *(call(entity) for entity in entities)])
            self.assertEqual(mock_collection.insert_many.call_count, 2)
            mock_collection.insert_one.assert_called_once()
            mock_array_split.assert_not_called()
