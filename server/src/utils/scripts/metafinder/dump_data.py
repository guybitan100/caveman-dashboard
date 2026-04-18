import subprocess

from elasticsearch import Elasticsearch
import boto3
from metafinder.models.index import MetaFinderIndex

INPUT_HOST = 'http://10.11.204.186:9210'
DEST_HOST = 'http://10.11.204.186:9210'

s3 = boto3.resource("s3", verify=False)
es = Elasticsearch(INPUT_HOST, timeout=30, retry_on_timeout=True, max_retries=3)


def dump_data_to_server(es_input=INPUT_HOST, es_output=DEST_HOST):
    for index in MetaFinderIndex:
        """Prerequisite: `npm install -g elasticdump`"""
        index = index.value
        subprocess.run(
            [
                "elasticdump",
                f"--input={es_input}/{index}",
                f"--output={es_output}/{index}",
                "--type=analyzer",
            ],
            shell=True,
        )
        subprocess.run(
            [
                "elasticdump",
                f"--input={es_input}/{index}",
                f"--output={es_output}/{index}",
                "--type=mapping",
            ],
            shell=True,
        )
        subprocess.run(
            [
                "elasticdump",
                f"--input={es_input}/{index}",
                f"--output={es_output}/{index}",
                "--type=data",
                "--limit=10000",
            ],
            shell=True,
        )
