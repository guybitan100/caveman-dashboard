from metafinder_core.queries import CryptoQueryParams


def test_crypto_languages_query():
    """
    Test that crypto query with languages returns the correct items
    """
    query = CryptoQueryParams(
        languages=['en', 'es'],
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.language in ['en', 'es'], f"Expected language 'en' or 'es', but got {result.language}"


def test_crypto_coins_query():
    """
    Test that crypto query with coins returns the correct items
    """
    query = CryptoQueryParams(
        coins=['BTC', 'ETH'],
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.coin in ['BTC', 'ETH'], f"Expected coin 'BTC' or 'ETH', but got {result.coin}"


def test_crypto_types_query():
    """
    Test that crypto query with types returns the correct items
    """
    query = CryptoQueryParams(
        types=['wallet', 'transaction'],
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.type in ['wallet', 'transaction'], f"Expected type 'wallet' or 'transaction', but got {result.type}"


def test_crypto_combined_query():
    """
    Test that crypto query with multiple parameters returns the correct items
    """
    query = CryptoQueryParams(
        coins=['BTC'],
        types=['transaction'],
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.coin == 'BTC', f"Expected coin 'bitcoin', but got {result.coin}"
        assert result.type == 'transaction', f"Expected type 'type1', but got {result.type}"