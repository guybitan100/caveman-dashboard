# MetaFinder Core

MetaFinder Core is the core library for the MetaFinder service, which provides metadata querying capabilities for various data types. This library includes query builders, query parameters, and response parsers to facilitate the interaction with the MetaFinder service.

### installing with Athena or OpenSearch Extras

To install the package with Athena or OpenSearch extras, use the following commands:

For Athena:

```bash
poetry install --extras "athena"
```

For OpenSearch:
```bash
poetry install --extras "opensearch"
```

## Usage

### Query Parameters

The metafinder_core package provides various query parameter classes for different data types. Each query parameter class inherits from the MetaFinderQueryParams base class.

Example:

```python
from metafinder_core.queries import NameQueryParams

query_params = NameQueryParams(
    is_surname=True,
    country_code='US',
    alphabet='Latin'
)
query_body = query_params.build(count=10)
response = query_params.execute(query_body)
results = query_params.parse(response)

for result in results:
    print(result)
```

### Query Method

The metafinder_core package also provides a convenient `query` method that combines the functionality of query parameters, query builders, and clients into a single method call.

Example:

```python
from metafinder_core.queries import NameQueryParams

query_params = NameQueryParams(
    is_surname=True,
    country_code='US',
    alphabet='Latin'
)

results = query_params.query(count=10)

for result in results:
    print(result)
```

### Query Builders

The metafinder_core package provides query builders for different backends. Each query builder inherits from the BaseMetafinderQueryBuilder base class.

Example:

```python
from typing import Dict, Callable, Literal

from pydantic import Field

from metafinder_core.models import LocalizedNameModel
from metafinder_core.queries import MetaFinderQueryParams, HiddenStaticField, MetaFinderIndex
from model.metafinder.data_types import DataType


class NameQueryParams(MetaFinderQueryParams[LocalizedNameModel]):
    data_type: Literal[DataType.Name] = HiddenStaticField(DataType.Name)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Name)
    metafinder_model_class: LocalizedNameModel = HiddenStaticField(LocalizedNameModel)
    id_field: Callable[[LocalizedNameModel], str] = HiddenStaticField(lambda x: f'{x.name}|{x.is_surname}|{x.country_code}')

    is_surname: bool | None = Field(default=None)
    is_male: bool | None = Field(default=None)
    country_code: str | None = Field(default=None)
    alphabet: str | None = Field(default=None)

    def build(self, count: int = None) -> Dict:
        body = self._builder.init_query_body(count)
        if self.is_surname is not None:
            body = self._builder.is_surname_query(body, self.is_surname)
        if self.is_male is not None:
                body = self._builder.is_male_query(body, self.is_male)
        if self.country_code is not None:
            body = self._builder.country_code_query(body, self.country_code)
        if self.alphabet is not None:
            body = self._builder.alphabet_query(body, self.alphabet)
        return body
```

### Clients

The metafinder_core package provides clients for different backends. Each client inherits from the BaseQueryClient base class.

Example:

```python
from metafinder_core.clients.athena import AthenaClient
from core.config import SETTINGS

client = AthenaClient(
    database_name=SETTINGS.METAFINDER_ATHENA_DATABASE_NAME,
    output_location=SETTINGS.METAFINDER_ATHENA_OUTPUT_LOCATION,
    aws_region=SETTINGS.AWS_REGION
)

query_body = {
    "select": "*",
    "where": ["category = 'example'"],
    "limit": 10
}

results = client.query(index="example_index", body=query_body)
for result in results:
    print(result)
```

### Parsers

The metafinder_core package provides response parsers for different backends. Each response parser inherits from the BaseMetafinderQueryResponseParser base class.

Example:

```python
from metafinder_core.parsers.athena import AthenaMetafinderQueryResponseParser
from metafinder_core.models import NameModel

parser = AthenaMetafinderQueryResponseParser()
response = [
    {"id": "1", "name": "John Doe", "is_surname": True, "country_code": "US", "alphabet": "Latin"},
    # more items...
]

results = parser.parse(response, model_class=NameModel)
for result in results:
    print(result)
```

MetaFinderModel
The metafinder_core package provides a base model class MetafinderModel for all MetaFinder response objects

Example:

```python
from metafinder_core.models import FileModel

file = FileModel(
    s3_key="example_key",
    size=1024,
    format="pdf",
    md5="example_md5"
)

print(file.presigned_url)
```

