from pydantic import BaseModel, PositiveInt, Field, model_validator

from core.config import SETTINGS
from core.titan_logger import logger
from model.metafinder.data_types import DataType, data_type_count_limit
from metafinder_core.queries import QueryParamsUnion

class GetRequest(BaseModel):
    data_type: DataType
    queries: QueryParamsUnion | None = Field(discriminator='data_type')
    
    @model_validator(mode="before")
    def validate_queries(cls, values: dict) -> dict:
        data_type = values['data_type']
        queries = values.get('queries', {})
        queries['data_type'] = data_type
        values['queries'] = queries
        return values


class GetDataRequest(GetRequest):
    count: PositiveInt = Field(ge=1, le=SETTINGS.METAFINDER_MAX_ITEMS)
    
    @model_validator(mode="before")
    def validate_count(cls, values: dict) -> dict:
        data_type = values['data_type']
        count = values['count']
        max_count = data_type_count_limit.get(data_type, SETTINGS.METAFINDER_MAX_ITEMS)
        if count > max_count:
            logger.warning(
                f'Requested count {count} for {data_type} exceeds max items ({max_count}), truncating to max items',
                data_type=data_type, max_count=max_count, count=count
            )
            values['count'] = max_count
        return values


