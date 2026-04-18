from enum import StrEnum

from pydantic import BaseModel, Field


class QueryOperator(StrEnum):
    AND = 'must'
    OR = 'should'


class ArrayQuery(BaseModel):
    values: list[str] = Field(default_factory=list)
    operator: QueryOperator = Field(default=QueryOperator.AND)
