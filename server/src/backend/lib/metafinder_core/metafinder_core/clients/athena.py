from collections import defaultdict
from typing import Any, Iterator

import boto3
import time
from mypy_boto3_athena import AthenaClient as AWSAthenaClient
from mypy_boto3_athena.type_defs import DatumTypeDef

from core.config import SETTINGS
from core.titan_logger import logger
from metafinder_core.clients.base import BaseQueryClient
from metafinder_core.queries import MetaFinderIndex

_array_fields = defaultdict(list, {
    MetaFinderIndex.Image: ["categories"],
	MetaFinderIndex.App: ["category", "event_types"],
    MetaFinderIndex.Audio: ["categories"],
	MetaFinderIndex.Text: ["categories"],
	MetaFinderIndex.Url: ["categories"],
    MetaFinderIndex.Video: ["categories"],
    MetaFinderIndex.Chat: ["categories"],
})


class AthenaClient(BaseQueryClient):
    def __init__(self, database_name: str, output_location: str, aws_region: str):
        self._client: AWSAthenaClient = boto3.client("athena", region_name=aws_region)
        self._database_name = database_name
        self._output_location = output_location
    
    def _query(self, query: str) -> dict[Any, Any]:
        response = self._client.start_query_execution(
            QueryString=query,
            QueryExecutionContext={"Database": self._database_name},
            ResultConfiguration={
                "OutputLocation": self._output_location,
            },
        )
        logger.debug(f"Created Athena query execution with id {response['QueryExecutionId']}",
                     queryExecutionId=response["QueryExecutionId"])
        return response
    
    
    def _get_query_results(self, query_execution_id: str, next_token: str | None = None) -> Iterator[dict[Any, Any]]:
        if next_token:
            response = self._client.get_query_results(QueryExecutionId=query_execution_id, NextToken=next_token)
        else:
            response = self._client.get_query_results(QueryExecutionId=query_execution_id)
        # Extract column labels from the response
        column_labels = [column["Label"] for column in response["ResultSet"]["ResultSetMetadata"]["ColumnInfo"]]
        
        # Extract the rows of data
        rows = response["ResultSet"]["Rows"]
        
        for row in rows:
            values = [field.get("VarCharValue") for field in row["Data"]]
            if all(value in column_labels for value in values):
                continue
            yield dict(zip(column_labels, values))
        next_token = response.get("NextToken")
        if next_token:
            yield from self._get_query_results(query_execution_id, next_token)
    
    def _has_query_succeeded(self, execution_id: str) -> bool:
        state = "RUNNING"
        max_execution = 30
        sleep_time = 2.0
        while max_execution > 0 and state in ["RUNNING", "QUEUED"]:
            max_execution -= 1
            response = self._client.get_query_execution(QueryExecutionId=execution_id)
            if (
                    "QueryExecution" in response
                    and "Status" in response["QueryExecution"]
                    and "State" in response["QueryExecution"]["Status"]
            ):
                state = response["QueryExecution"]["Status"]["State"]
                if state == "SUCCEEDED":
                    return True
                elif state == "FAILED":
                    logger.warn("query failed",
                                query_status={response["QueryExecution"]["Status"]['AthenaError']['ErrorMessage']})
            
            time.sleep(sleep_time)
        
        return False
    
    def _query_sync(self, query: str) -> Iterator[dict[Any, Any]]:
        response = self._query(query=query)
        execution_id = response["QueryExecutionId"]
        succeeded = self._has_query_succeeded(execution_id)
        if not succeeded:
            raise Exception("query failed")
        return self._get_query_results(execution_id)
    
    def query(self, index: MetaFinderIndex,  body: dict | str) -> list[dict]:
        if isinstance(body, str):
            query_string = body
        else:
            db_name = f'"{SETTINGS.METAFINDER_ATHENA_DATABASE_NAME}"."{index}"'
            query_string = f"SELECT {body['select']} FROM {db_name}"
            if body.get('where'):
                query_string += f" WHERE {' AND '.join(body['where'])}"
            if body.get('order_by'):
                query_string += f" ORDER BY {body['order_by']}"
            else:
                query_string += " ORDER BY rand()"
            if body.get('limit'):
                query_string += f" LIMIT {body['limit']};"
        result = list(self._query_sync(query_string))
        return result
    
    def get_term_count(self, index: MetaFinderIndex, term: str) -> dict[str, dict[str, str | int]]:
        if term in _array_fields[index]:
            query = f"WITH exploded AS (SELECT item AS {term} FROM {index} CROSS JOIN UNNEST({term}) AS t(item) ) SELECT {term}, COUNT(*) AS count FROM exploded GROUP BY {term} ORDER BY count DESC;"
        else:
            query = f"SELECT {term}, COUNT(*) as count FROM {index} GROUP BY {term}"
        result = self._query_sync(query)
        terms_count = {row[term]: {"name": row[term], "count": row["count"]} for row in result}
        return terms_count
    
    def get_term_options_range(self, index: MetaFinderIndex, options_term: str, range_term: str) -> dict[str, dict[str, int]]:
        options = self.get_term_count(index=index, term=options_term)
        result = {}
        for option in options:
            if options_term in _array_fields[index]:
                query = f"SELECT MIN({range_term}) as min, MAX({range_term}) as max FROM {index} WHERE contains({options_term}, '{option}')"
            else:
                query = f"SELECT MIN({range_term}) as min, MAX({range_term}) as max FROM {index} WHERE {options_term} = '{option}'"
            res = list(self._query_sync(query))
            result[option] = {"min": res[0]["min"], "max": res[0]["max"]}
        return result
    
    def get_term_avg(self, index: MetaFinderIndex, term: str) -> dict[str, int]:
        if term in _array_fields[index]:
            query = f"WITH exploded AS (SELECT item AS {term} FROM {index} CROSS JOIN UNNEST({term}) AS t(item) ) SELECT AVG({term}) AS avg FROM exploded;"
        else:
            query = f"SELECT AVG({term}) as avg FROM {index}"
        result = list(self._query_sync(query))
        return {term: int(float(result[0]["avg"]))}
    
    def get_count(self, index: str) -> int:
        query = f"SELECT COUNT(*) as count FROM {index}"
        result = list(self._query_sync(query))
        return int(float(result[0]["count"]))
    
    def get_report_fields(self, index: MetaFinderIndex, model_type: str | None = None) -> str:
        db_name = f'"{SETTINGS.METAFINDER_ATHENA_DATABASE_NAME}"."{index}"'
        query =f'WITH version_ranking AS (SELECT version, ROW_NUMBER() OVER (ORDER BY version DESC) AS rank FROM {db_name} GROUP BY version) SELECT t.* FROM {db_name} t JOIN version_ranking vr ON t.version = vr.version WHERE vr.rank = 1'
        if model_type:
            query += f" AND model_type = '{model_type}'"
        query += " LIMIT 10000;"
        return query
        

