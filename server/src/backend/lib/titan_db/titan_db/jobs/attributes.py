import pickle
from abc import abstractmethod, ABC
from uuid import uuid4
from pathlib import PurePath
import json
from enum import Enum
from typing import Iterator, override

from networkx import DiGraph
from pydantic import BaseModel
from pynamodb.attributes import JSONAttribute, UnicodeAttribute, UnicodeSetAttribute, Attribute, BinaryAttribute
from pynamodb.models import Model

from core.config import SETTINGS
from core.s3_client import TitanS3Client
from core.titan_logger import logger
from model.job import CustomEvent
from model.utils import deserialize
from titan_db.jobs.errors import DBAttributeDeserializationError, DBAttributeSerializationError

def create_enum_attribute[T](enum_class: type[T: Enum]) -> type[UnicodeAttribute]:

    class EnumAttribute(UnicodeAttribute):

        def serialize(self, value: T) -> str:
            try:
                return value.value
            except Exception as e:
                raise DBAttributeSerializationError(
                    f'Could not serialize {enum_class.__name__} attribute') from e

        def deserialize(self, value: str) -> T:
            try:
                return enum_class(value)
            except Exception as e:
                raise DBAttributeDeserializationError(
                    f'Could not deserialize {enum_class.__name__} attribute') from e

    return EnumAttribute

def create_relationship_attribute[T](model_class: type[T: Model]) -> type[UnicodeAttribute]:

    class RelationshipAttribute(UnicodeAttribute):

        def serialize(self, value: T) -> str:
            try:
                data = getattr(value, value._hash_keyname)
                value.save()
                return data
            except Exception as e:
                raise DBAttributeSerializationError(
                    f'Could not serialize {model_class.__name__} attribute') from e

        def deserialize(self, value: str) -> T:
            try:
                data = model_class.get(value)
                return data
            except Exception as e:
                raise DBAttributeDeserializationError(
                    f'Could not deserialize {model_class.__name__} attribute') from e

    return RelationshipAttribute

def create_relationship_set_attribute[T](model_class: type[T: Model]) -> type[Attribute]:

    class RelationshipSetAttribute(UnicodeSetAttribute):

        def serialize(self, value: list[T]) -> list[str] | None:
            try:
                if not value:
                    return None
                hash_keyname = value[0]._hash_keyname

                with model_class.batch_write() as batch:
                    for item in value:
                        batch.save(item)
                return [getattr(i, hash_keyname) for i in value]
            except Exception as e:
                raise DBAttributeSerializationError(
                    f'Could not serialize {model_class.__name__} attribute') from e

        def deserialize(self, value: list[str]) -> list[T]:
            try:
                return [model_class.get(v) for v in value]
            except Exception as e:
                raise DBAttributeDeserializationError(
                    f'Could not deserialize {model_class.__name__} attribute') from e

    return RelationshipSetAttribute

s3_client = TitanS3Client()

S3_KEY_PREFIX = b'_s3_key_='

class S3FileAttribute[T](ABC, BinaryAttribute):
    def __init__(self, *args, max_size_bytes: int = SETTINGS.MAX_DYNAMO_S3_ATTR_SIZE_BYTES, **kwargs):
        super().__init__(*args, legacy_encoding=False, **kwargs)
        self.max_size_bytes = max_size_bytes

    @override
    def serialize(self, value: T) -> bytes:
        try:
            serialized_value = self._serialize(value)
            if len(serialized_value) <= self.max_size_bytes:
                return serialized_value
            file_name = PurePath(SETTINGS.S3_BUCKET_DYNAMO_PREFIX, uuid4().hex).as_potitan()
            s3_client.upload_object(bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME, file_name=file_name, obj=serialized_value)
            logger.debug(f'DB: saved to {file_name} in S3, value: {serialized_value}')
            return f'{S3_KEY_PREFIX}{file_name}'.encode('ascii')
        except Exception as e:
            raise DBAttributeSerializationError(f'Could not serialize attribute: {e}')

    @abstractmethod
    def _serialize(self, value: T) -> bytes:
        raise NotImplementedError

    @override
    def deserialize(self, value: bytes) -> T:
        try:
            if value.startswith(S3_KEY_PREFIX):
                file_name = value[len(S3_KEY_PREFIX):].decode('ascii')
                value = s3_client.download_object(bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME, file_name=file_name)
            data = self._deserialize(value)
            return data
        except Exception as e:
            raise DBAttributeDeserializationError(f'Could not deserialize attribute: {e}') from e

    @abstractmethod
    def _deserialize(self, value: str | bytes) -> T:
        raise NotImplementedError

    @classmethod
    def delete_s3_object(cls, value: bytes) -> None:
        try:
            if value.startswith(S3_KEY_PREFIX):
                file_name = value[len(S3_KEY_PREFIX):].decode('ascii')
                s3_client.delete_object(bucket_name=SETTINGS.S3_TITAN_BUCKET_NAME, file_name=file_name)
                logger.debug(f'DB: deleted {file_name} from S3')
        except Exception as e:
            logger.error(f'Could not delete S3 object for attribute: {e}')

class CustomEventsAttribute(S3FileAttribute[dict[str, CustomEvent]]):

    @override
    def _serialize(self, value: dict[str, CustomEvent]) -> bytes:
        return json.dumps([v.model_dump(mode='json') for v in value.values()]).encode('utf-8')

    @override
    def _deserialize(self, value: bytes) -> dict[str, CustomEvent]:
        custom_events = (
            deserialize(data, CustomEvent)
            for data in json.loads(value.decode('utf-8'))
        )
        return {event.event_id: event for event in custom_events}

def create_pydantic_attribute[T](model_class: type[T: BaseModel]) -> type[JSONAttribute]:

    class PydanticAttribute(JSONAttribute):

        def serialize(self, value: T) -> str:
            return value.model_dump_json()

        def deserialize(self, value: str) -> T:
            data = super().deserialize(value)
            return deserialize(data, model_class)

    return PydanticAttribute

class PickledGraphAttribute(S3FileAttribute[DiGraph]):

    @override
    def _serialize(self, graph: DiGraph) -> bytes:
        return pickle.dumps(graph, protocol=SETTINGS.STORIES_GRAPH_PICKLE_PROTOCOL)

    @override
    def _deserialize(self, value: bytes) -> DiGraph:
        return pickle.loads(value)
