from metafinder_core.queries import NameQueryParams


def test_name_is_surname_query():
    query = NameQueryParams(
        is_surname=True,
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.is_surname is True, f"Expected is_surname to be True, but got {result.is_surname}"


def test_name_country_code_query():
    query = NameQueryParams(
        country_code='US',
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.country_code == 'US', f"Expected country_code 'US', but got {result.country_code}"


def test_name_alphabet_query():
    query = NameQueryParams(
        alphabet='latin',
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.alphabet == 'latin', f"Expected alphabet 'latin', but got {result.alphabet}"


def test_name_is_surname_and_is_male_query():
    query = NameQueryParams(
        is_surname=True,
        is_male=True,
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.is_surname is True, f"Expected is_surname to be True, but got {result.is_surname}"
        assert result.male_prob >= 0.5, f"Expected male_prob >= 0.5, but got {result.male_prob}"


def test_name_combined_query():
    query = NameQueryParams(
        is_surname=True,
        country_code='US',
        alphabet='latin',
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.is_surname is True, f"Expected is_surname to be True, but got {result.is_surname}"
        assert result.country_code == 'US', f"Expected country_code 'US', but got {result.country_code}"
        assert result.alphabet == 'latin', f"Expected alphabet 'latin', but got {result.alphabet}"