import pytest

from metafinder_core.queries import ChatQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator


def test_chat_single_languages_query():
    """
    Test that chat single languages query returns the correct items
    """
    query = ChatQueryParams(
        languages=['en'],
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.language == 'en', f"Expected 'en' in language, but got {result.language}"


def test_chat_multiple_languages_query():
    """
    Test that chat multiple languages query returns the correct items
    """
    query = ChatQueryParams(
        languages=['en', 'es'],
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.language in ['en', 'es'], f"Expected 'en' or 'es' in language, but got {result.language}"
	    

def test_chat_single_categories_query():
    """
    Test that chat single categories query returns the correct items
    """
    query = ChatQueryParams(
        categories=ArrayQuery(values=['FAMILY']),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'FAMILY' in result.categories, \
            f"Expected 'FAMILY' in categories, but got {result.categories}"
	    

def test_chat_multiple_categories_or_query():
    """
    Test that chat multiple categories OR query returns the correct items
    """
    query = ChatQueryParams(
        categories=ArrayQuery(values=['FAMILY', 'DRUGS']),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'FAMILY' in result.categories or 'DRUGS' in result.categories, \
            f"Expected 'FAMILY' or 'DRUGS' in categories, but got {result.categories}"
        

def test_chat_multiple_categories_and_query():
    """
    Test that chat multiple categories AND query returns the correct items
    """
    query = ChatQueryParams(
        categories=ArrayQuery(values=['FAMILY', 'DRUGS'], operator=QueryOperator.AND),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert 'FAMILY' in result.categories and 'DRUGS' in result.categories, \
            f"Expected 'FAMILY' and 'DRUGS' in categories, but got {result.categories}"
	    

def test_chat_languages_and_categories_query():
    """
    Test that chat languages and categories query returns the correct items
    """
    query = ChatQueryParams(
        languages=['en'],
        categories=ArrayQuery(values=['FAMILY']),
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.language == 'en', f"Expected 'en' in language, but got {result.language}"
        assert 'FAMILY' in result.categories, f"Expected 'FAMILY' in categories, but got {result.categories}"