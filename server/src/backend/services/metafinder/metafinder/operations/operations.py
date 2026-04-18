from functools import wraps

from core.titan_logger import logger
from model.metafinder.data_types import DataType, KeywordTerms, RangeTerms
from metafinder_core.models import MetafinderModel
from metafinder_core.clients.base import BaseQueryClient
from metafinder.models.requests import GetRequest, GetDataRequest


class MetaFinderError(Exception):
    def __init__(self, *args, **kwargs):
        super().__init__(args, kwargs)


def handle_errors(func):

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            return result
        except Exception as e:
            logger.error(e)
            raise MetaFinderError(e)

    return wrapper


@handle_errors
def get_data(request: GetDataRequest) -> list[MetafinderModel]:
    try:
        results = request.queries.query(request.count)
        return results
    except Exception as e:
        logger.error(e)
        raise MetaFinderError(e)


@handle_errors
def get_count(request: GetRequest, client: BaseQueryClient) -> int:
    index = client.get_data_type_index(request.data_type)
    result = client.get_count(index)
    return result


@handle_errors
def get_term_count(data_type: DataType, term: KeywordTerms, client: BaseQueryClient) -> dict[str, dict[str, str | int]]:
    index = client.get_data_type_index(data_type)
    return client.get_term_count(index, term)


@handle_errors
def get_term_avg(data_type: DataType, term: RangeTerms, client: BaseQueryClient) -> dict[str, int]:
    index = client.get_data_type_index(data_type)
    return client.get_term_avg(index, term)


@handle_errors
def get_term_options_range(
    data_type: DataType, options_term: KeywordTerms, range_term: RangeTerms, client: BaseQueryClient
) -> dict[str, dict[str, int]]:
    index = client.get_data_type_index(data_type)
    return client.get_term_options_range(index, options_term, range_term)

