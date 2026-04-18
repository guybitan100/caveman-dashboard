import pytest

from metafinder_core.queries import ApplicationQueryParams


def test_app_ids_query():
    query = ApplicationQueryParams(
        app_ids=['androidesko.android.electronicthermometer', 'com.banglalink.toffee'],
    )
    results = query.query()

    assert len(results) == 2, f"Expected 2 results, but got {len(results)}"
    for result in results:
        assert result.app_id in ['androidesko.android.electronicthermometer', 'com.banglalink.toffee'], f"Expected 'androidesko.android.electronicthermometer', 'com.banglalink.toffee' in app_id, but got {result.app_id}"


@pytest.mark.skip(reason="No app data with category")
def test_app_category_query():
    query = ApplicationQueryParams(
        category='games',
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.category == 'games', f"Expected 'games' in category, but got {result.category}"


def test_app_os_query():
    query = ApplicationQueryParams(
        os='android',
    )
    results = query.query(10)

    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.os == 'android', f"Expected 'android' in os, but got {result.os}"
