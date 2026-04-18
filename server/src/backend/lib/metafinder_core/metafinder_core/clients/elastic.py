from opensearchpy import OpenSearch

from core.config import SETTINGS
from metafinder_core.clients.base import BaseQueryClient
from metafinder_core.queries import MetaFinderIndex


class ElasticSearchClient(BaseQueryClient):

    def __init__(self):
        self._client = OpenSearch(
            hosts=[{"host": SETTINGS.METAFINDER_OPENSEARCH_HOST, "port": 443}],
            retry_on_timeout=True,
            max_retries=3,
            verify_certs=False,
            use_ssl=True,
            http_auth=(SETTINGS.METAFINDER_OPENSEARCH_USER, SETTINGS.METAFINDER_OPENSEARCH_PASSWORD)
        )

    def get_term_count(self, index: MetaFinderIndex, term: str) -> dict[str, dict[str, str | int]]:
        terms_count = {}
        res = self._client.search(
            index=index,
            body={
                "size": 0,
                "aggs": {
                    f"{term}": {
                        "terms": {
                            "size": 1000,  # return max 1000 terms just to be safe, but this is more than enough
                            "field": term,
                        }
                    }
                },
            },
        )
        for elastic_term in res["aggregations"][term]["buckets"]:
            terms_count[elastic_term["key"]] = {
                "name": elastic_term["key"],
                "count": elastic_term["doc_count"],
            }
        return terms_count
    
    
    def get_term_options_range(self, index: MetaFinderIndex, options_term: str, range_term: str) -> dict[str, dict[str, int]]:
        result = {}
        options = self.get_term_count(index=index, term=options_term)
        range_min = f"{range_term}_min"
        range_max = f"{range_term}_max"
        for option in options:
            res = self._client.search(
                index=index,
                body={
                    "size": 0,
                    "query": {"term": {options_term: option}},
                    "aggs": {
                        range_min: {
                            "min": {"field": range_term},
                        },
                        range_max: {"max": {"field": range_term}},
                    },
                },
            )
            result[option] = {
                "min": res["aggregations"][range_min]["value"],
                "max": res["aggregations"][range_max]["value"],
            }
    
        return result
    
    def get_term_avg(self, index: MetaFinderIndex, term: str) -> int:
        res = self._client.search(index=index, body={"size": 0, "aggs": {f"{term}": {"avg": {"field": term}}}})
        return res["aggregations"][term]["value"]
    
    def get_count(self, index: MetaFinderIndex) -> dict:
        return self._client.count(index=index)
    
    def query(self, index: MetaFinderIndex, body: dict):
        return self._client.search(index=index, body=body)
    
    def get_report_fields(self, index: MetaFinderIndex, model_type: str | None = None) -> dict:
        body = {
            "size": 0,
            "aggs": {
                "group_by_version": {
                    "terms": {
                        "field": "version",
                        "order": {"_term": "desc"},
                        "size": 1,
                    },
                    "aggs": {
                        "max_version": {
                            "top_hits": {
                                "from": 0,
                                "size": 10000,  # Same value as the "max_inner_result_window" setting
                            }
                        }
                    },
                }
            },
        }
        # Add model_type constraint if specified
        if model_type is not None:
            body["query"] = {"match": {"model_type": model_type}}
        return body
