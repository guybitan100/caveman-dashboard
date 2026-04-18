from metafinder_core.queries import DocumentQueryParams
from model.metafinder.queries import QueryOperator, ArrayQuery


def test_document_single_format_query():
	query = DocumentQueryParams(
		formats=['docx'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'docx' in result.format, f"Expected 'docx' in format, but got {result.format}"
		

def test_document_min_size_query():
	query = DocumentQueryParams(
		min_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size >= 1000, f"Expected size >= 1000, but got {result.size}"
		
		
def test_document_max_size_query():
	query = DocumentQueryParams(
		max_size=100000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size <= 100000, f"Expected size <= 1000, but got {result.size}"
		

def test_document_min_max_size_query():
	query = DocumentQueryParams(
		min_size=1000,
		max_size=20000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.size <= 20000, f"Expected 1000 <= size <= 2000, but got {result.size}"
		

def test_document_multiple_queries():
	query = DocumentQueryParams(
		formats=['docx', 'txt'],
		min_size=1000,
		max_size=200000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'docx' in result.format or 'txt' in result.format, \
			f"Expected 'docx' or 'txt' in format, but got {result.format}"
		assert 1000 <= result.size <= 200000, f"Expected 1000 <= size <= 2000, but got {result.size}"