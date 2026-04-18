from metafinder_core.queries import EntityQueryParams


def test_entity_single_ids_query():
	query = EntityQueryParams(
		id=['220b3aac-0725-432e-b584-265dabd6db31'],
	)
	results = query.query(10)

	assert len(results) == 1, f"Expected 1 results, but got {len(results)}"
	for result in results:
		assert result.id == '220b3aac-0725-432e-b584-265dabd6db31', f"Expected '220b3aac-0725-432e-b584-265dabd6db31' in id, but got {result.id}"



def test_entity_multiple_ids_query():
	query = EntityQueryParams(
		id=['220b3aac-0725-432e-b584-265dabd6db31', '3de25202-3f8b-4a6d-94ea-984495fb332a'],
	)
	results = query.query(10)

	assert len(results) == 2, f"Expected 2 results, but got {len(results)}"
	for result in results:
		assert result.id in ['220b3aac-0725-432e-b584-265dabd6db31', '3de25202-3f8b-4a6d-94ea-984495fb332a'], f"Expected '220b3aac-0725-432e-b584-265dabd6db31', '3de25202-3f8b-4a6d-94ea-984495fb332a' in id, but got {result.id}"


def test_entity_empty_query():
	query = EntityQueryParams()
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"