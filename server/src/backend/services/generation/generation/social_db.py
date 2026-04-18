import json

import itertools
import math

import numpy as np
from pydantic import parse_obj_as
from pymongo.collection import Collection

from model.types import Entity
from core.config import SETTINGS
from core.titan_logger import logger
from generation.simulation.social import SocialContext, LocationIdAllocation
from model.utils import deserialize
from titan_db.events.db import job_db_session, GRAPH_CHUNK_SIZE, FIELD_CLASS_NAME, SOCIAL_CONTEXT_WEIGHTS_CLASS_NAME, \
    SOCIAL_CONTEXT_LOCATIONS_CLASS_NAME, QUERY_FILTERS,  serialize


@job_db_session
def write_social_context(job_id: str, social_context: SocialContext, job_collection: Collection = None) -> None:
    logger.info(f"Writing social context for job {job_id}")

    # Write entity IDs
    logger.info(f"Writing entities for job {job_id}")
    job_collection.insert_many(
        map(serialize, itertools.chain((social_context.owner_entity,), social_context.entities))
    )

    # Write weights
    num_sections = math.ceil(len(social_context.weights) / GRAPH_CHUNK_SIZE)
    if num_sections > 0:
        weights_sub_arrays = np.array_split(social_context.weights, num_sections)
        weights_documents = [
            {
                FIELD_CLASS_NAME: SOCIAL_CONTEXT_WEIGHTS_CLASS_NAME,
                'index': idx,
                'weights': weights_array.tolist()
            }
            for idx, weights_array in enumerate(weights_sub_arrays)
        ]
    else:
        # In case there are no entities besides phone owner
        weights_documents = [
            {
                FIELD_CLASS_NAME: SOCIAL_CONTEXT_WEIGHTS_CLASS_NAME,
                'index': 0,
                'weights': []
            }
        ]

    logger.info(f"Writing weights for job {job_id}")
    job_collection.insert_many(weights_documents)

    # Write Locations
    locations_document = {
        FIELD_CLASS_NAME: SOCIAL_CONTEXT_LOCATIONS_CLASS_NAME,
        'locations': {
            task_id: json.loads(location_allocation.json())
            for task_id, location_allocation in social_context.location_allocations.items()
        }
    }
    logger.info(f"Writing allocated locations for job {job_id}")
    job_collection.insert_one(locations_document)
    logger.info(f"Social context saved")


@job_db_session
def read_social_context(job_id: str, entity_weights: bool = True, job_collection: Collection = None) -> SocialContext:
    logger.debug('Reading social context from DB', job_id=job_id)
    owner_entity_data = job_collection.find_one(
        {FIELD_CLASS_NAME: Entity.__name__, "is_owner": True}, QUERY_FILTERS,
    )
    Entity.model_validate(owner_entity_data)
    owner_entity = deserialize(owner_entity_data, Entity)

    entities_iter = job_collection.find(
        {FIELD_CLASS_NAME: Entity.__name__, "is_owner": False}, QUERY_FILTERS,
    ).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)
    entities = [deserialize(entity_data, Entity) for entity_data in entities_iter]

    if not entity_weights:
        weights = None
    else:
        weights_iter = job_collection.find(
            {FIELD_CLASS_NAME: SOCIAL_CONTEXT_WEIGHTS_CLASS_NAME}
        ).batch_size(SETTINGS.DB_DOCUMENT_DB_BATCH_SIZE)
        weights_arrays = sorted(weights_iter, key=lambda x: x['index'], reverse=True)
        weights = np.array([item for sublist in weights_arrays for item in sublist['weights']])

    locations_document = job_collection.find_one({FIELD_CLASS_NAME: SOCIAL_CONTEXT_LOCATIONS_CLASS_NAME})
    location_allocations = {
        task_id: LocationIdAllocation.model_validate(location_allocation_dict)
        for task_id, location_allocation_dict in locations_document['locations'].items()
    }

    social_context = SocialContext(
        owner_entity=owner_entity,
        entities=entities,
        weights=weights,
        location_allocations=location_allocations
    )

    return social_context

