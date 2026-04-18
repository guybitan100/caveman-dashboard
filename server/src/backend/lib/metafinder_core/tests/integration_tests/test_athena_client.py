import pytest

from core.config import SETTINGS
from metafinder_core.clients.athena import AthenaClient
from metafinder_core.queries import MetaFinderIndex


@pytest.fixture
def athena_client():
    client = AthenaClient(database_name=SETTINGS.METAFINDER_ATHENA_DATABASE_NAME, output_location=SETTINGS.METAFINDER_ATHENA_OUTPUT_LOCATION, aws_region=SETTINGS.AWS_REGION)
    return client


@pytest.mark.parametrize("index, term", [
    (MetaFinderIndex.Image, "categories"),
    (MetaFinderIndex.Crypto, "coin"),
    (MetaFinderIndex.Name, "alphabet"),
])
def test_get_term_count(athena_client, index, term):
    result = athena_client.get_term_count(index, term)
    assert len(result) > 0


@pytest.mark.parametrize("index, options_term, range_term", [
    (MetaFinderIndex.Image, "categories", "width"),
    (MetaFinderIndex.Audio, "format", "duration"),
])
def test_get_term_options_range(athena_client, index, options_term, range_term):
    result = athena_client.get_term_options_range(index, options_term, range_term)
    assert len(result) > 0
    
    
@pytest.mark.parametrize("index, term, expected_result", [
    (MetaFinderIndex.Image, "width", 674),
    (MetaFinderIndex.Audio, "duration", 124),
    (MetaFinderIndex.Chat, "size", 32),
])
def test_get_term_avg(athena_client, index, term, expected_result):
    result = athena_client.get_term_avg(index, term)
    assert result == {term: expected_result}

@pytest.mark.parametrize("index, expected_result", [
    (MetaFinderIndex.Image, 4057240),
])
def test_get_count(athena_client, index, expected_result):
    result = athena_client.get_count(index)
    assert result == expected_result