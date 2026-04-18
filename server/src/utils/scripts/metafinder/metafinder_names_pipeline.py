import json
from pathlib import Path
from typing import Iterator

import pandas as pd

from alphabet_detector import AlphabetDetector
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk, reindex
from loguru import logger
from pydantic import confloat

from metafinder_core.models import MetafinderMetadata

_detector = AlphabetDetector()
NAMES_INDEX = 'name_index'
es = Elasticsearch(hosts="http://10.11.204.186:9210", http_compress=True, timeout=30, retry_on_timeout=True)


class LocalizedName(MetafinderMetadata):
    """
    Representing MetaFinder LocalizedName response.
    Attributes:
        name:           Name (first or last)
        is_surname:     Indicates if name is a surname, else first name
        male_prob:      Probability that name is commonly a male name, otherwise female
        country_code:   Country code
    """
    name: str
    is_surname: bool
    male_prob: confloat(ge=0.0, le=1.0)
    country_code: str
    alphabet: str

    def get_elastic_id(self) -> str:
        return f'{self.name}|{self.is_surname}|{self.country_code}'


def class_to_action(data: LocalizedName) -> dict:
    return {
        '_type': '_doc',
        '_index': NAMES_INDEX,
        '_source': data.dict(),
        '_id': data.get_elastic_id(),
        '_op_type': 'index'
    }


def insert_to_es(docs_generator):
    logger.info('Adding records to ElasticSearch')
    response = bulk(es, docs_generator)
    logger.info(json.dumps(response, indent=2))


def process_file(file_path: Path) -> Iterator[LocalizedName]:
    logger.info(f'Processing file {file_path}')

    # read the file and group the DataFrame by first name
    df = pd.read_csv(file_path, names=['first_name', 'last_name', 'gender', 'country_code'], keep_default_na=False, na_values='')
    country_code = df['country_code'].mode()[0]

    last_names = df.groupby('last_name')
    df = df.groupby('first_name')

    # calculate the probability of the gender being 'M' for each first name
    probabilities = df['gender'].value_counts(normalize=True).loc[:, 'M'].reset_index(name='male_prob')

    num_undetected_firstnames = 0
    num_undetected_surnames = 0

    # create LocalizedName objects for each first name and last name
    for _, row in probabilities.iterrows():
        try:
            yield class_to_action(LocalizedName(
                name=row['first_name'],
                is_surname=False,
                male_prob=row['male_prob'],
                country_code=country_code,
                alphabet=_detector.detect_alphabet(row['first_name']).pop().lower()
            ))
        except KeyError:
            logger.warning(f'No alphabet detected for first name "{row["first_name"]}", skipping...')
            num_undetected_firstnames += 1
            continue

    for name in last_names:
        try:
            yield class_to_action(LocalizedName(
                name=name[0],
                is_surname=True,
                male_prob=0.5,
                country_code=country_code,
                alphabet=_detector.detect_alphabet(name[0]).pop().lower()
            ))
        except KeyError:
            logger.warning(f'No alphabet detected for surname "{name[0]}", skipping...')
            num_undetected_surnames += 1
            continue

    logger.info(f'Done processing file {file_path}')
    logger.info(f'Total undetected first names: {num_undetected_firstnames}')
    logger.info(f'Total undetected surnames: {num_undetected_surnames}')


def create_index():
    es.indices.delete(index=NAMES_INDEX)
    mapping = {
        'mappings': {
            'properties': {
                'name': {'type': 'text'},
                'male_prob': {'type': 'float'},
                'alphabet': {'type': 'keyword'},
                'country_code': {'type': 'keyword'}
            }
        }
    }
    es.indices.create(index=NAMES_INDEX, ignore=400, mappings=mapping)


def main(files_dir: Path):
    # create_index()    # NOTE produces error

    """
    NEW_INDEX = 'name-new'
    mapping = {
        'mappings': {
            'properties': {
                'name': {'type': 'text'},
                'male_prob': {'type': 'float'},
                'alphabet': {'type': 'keyword'},
                'country_code': {'type': 'keyword'}
            }
        }
    }
    es.indices.delete(index=NEW_INDEX)
    es.indices.create(body=mapping, index=NEW_INDEX)
    es.reindex(body={
        "source": {
            "index": NAMES_INDEX
        },
        "dest": {
            "index": NEW_INDEX
        }
    },
        requests_per_second=0.5
    )
    es.indices.delete(index=NAMES_INDEX)
    es.indices.create(body=mapping, index=NAMES_INDEX)
    es.reindex(body={
        "source": {
            "index": NEW_INDEX
        },
        "dest": {
            "index": NAMES_INDEX
        }
    },
        requests_per_second=0.5)
    """

    flag = False    # flag used for skipping previously processed files
    for p in sorted(Path(files_dir).glob('*.csv')):
        """This code is for skipping previously processed files; this script can produce non-deterministic errors"""
        if p.stem == 'PE':  # name of file (without extension) that failed last
            flag = True
        if not flag:
            continue
        """End of skipping code"""
        data = process_file(file_path=p)
        insert_to_es(data)


if __name__ == '__main__':
    main(Path('Path-To-Directory-of-CSV-Files/'))
