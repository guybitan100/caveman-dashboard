from metafinder_core.queries import CellTowerQueryParams


def test_cell_tower_lat_lon_query():
    """
    Test that cell tower query with latitude and longitude returns the correct items
    """
    lat = 52.5200
    lon = 13.4050
    
    query = CellTowerQueryParams(
        lat=lat,
        lon=lon
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"


def test_cell_tower_single_mcc_query():
    """
    Test that cell tower query with single MCC returns the correct items
    """
    query = CellTowerQueryParams(
        mcc=[262]
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.mcc == 262, f"Expected MCC 262, but got {result.mcc}"


def test_cell_tower_multiple_mcc_query():
    """
    Test that cell tower query with multiple MCCs returns the correct items
    """
    query = CellTowerQueryParams(
        mcc=[262, 310]
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.mcc in [262, 310], f"Expected MCC 262 or 310, but got {result.mcc}"


def test_cell_tower_lat_lon_mcc_query():
    """
    Test that cell tower query with latitude, longitude, and MCC returns the correct items
    """
    lat = 52.5200
    lon = 13.4050
    
    query = CellTowerQueryParams(
        lat=lat,
        lon=lon,
        mcc=[262]
    )
    results = query.query(10)
    
    assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
    for result in results:
        assert result.mcc == 262, f"Expected MCC 262, but got {result.mcc}"
