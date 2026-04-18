from metafinder_core.queries import UrlQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator


def test_url_single_category_query():
    """
    Test that URL single category query returns the correct items
    """
    query = UrlQueryParams(
        categories=ArrayQuery(values=['Business']),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'Business' in result.categories, f"Expected 'Business' in categories, but got {result.categories}"


def test_url_multiple_categories_query():
    """
    Test that URL multiple categories OR query returns the correct items
    """
    query = UrlQueryParams(
        categories=ArrayQuery(values=['Business', 'Arts'], operator=QueryOperator.OR),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'Business' in result.categories or 'Arts' in result.categories, \
            f"Expected 'Business' or 'Arts' in categories, but got {result.categories}"


def test_url_single_cctld_query():
    """
    Test that URL single cctld query returns the correct items
    """
    query = UrlQueryParams(
        cctld=['.us'],
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.cctld == '.us', f"Expected '.us' in cctld, but got {result.cctld}"


def test_url_multiple_cctld_query():
    """
    Test that URL multiple cctld query returns the correct items
    """
    query = UrlQueryParams(
        cctld=['.us', '.uk'],
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.cctld in ['.us', '.uk'], f"Expected '.us' or '.uk' in cctld, but got {result.cctld}"
        

def test_url_combined_query():
    """
    Test that URL combined query returns the correct items
    """
    query = UrlQueryParams(
        categories=ArrayQuery(values=['Business', 'Arts'], operator=QueryOperator.OR),
        cctld=['.us', '.uk'],
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'Business' in result.categories or 'Arts' in result.categories, \
            f"Expected 'Business' or 'Arts' in categories, but got {result.categories}"
        assert result.cctld in ['.us', '.uk'], f"Expected '.us' or '.uk' in cctld, but got {result.cctld}"