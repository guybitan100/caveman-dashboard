from metafinder_core.queries import TextQueryParams
from model.metafinder.queries import QueryOperator, ArrayQuery


def test_text_empty_query():
	query = TextQueryParams()
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	

def test_text_min_size_query():
	query = TextQueryParams(
		min_size=10,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size >= 10, f"Expected size >= 1000, but got {result.size}"
		
		
def test_text_max_size_query():
	query = TextQueryParams(
		max_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size <= 1000, f"Expected size <= 1000, but got {result.size}"
		

def test_text_min_max_size_query():
	query = TextQueryParams(
		min_size=10,
		max_size=2000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 10 <= result.size <= 2000, f"Expected 1000 <= size <= 2000, but got {result.size}"
