from metafinder_core.queries import ImageQueryParams
from model.metafinder.queries import QueryOperator, ArrayQuery


def test_image_single_categories_query():
	query = ImageQueryParams(
		categories=ArrayQuery(values=['Beach']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Beach' in result.categories, f"Expected 'Beach' in categories, but got {result.categories}"


def test_image_multiple_categories_or_query():
	query = ImageQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['BarcodesQRCodes', 'Beach']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'BarcodesQRCodes' in result.categories or 'Beach' in result.categories, \
			f"Expected 'BarcodesQRCodes' or 'Beach' in categories, but got {result.categories}"


def test_image_multiple_categories_and_query():
	query = ImageQueryParams(
		categories=ArrayQuery(operator=QueryOperator.AND, values=['BarcodesQRCodes', 'Beach']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'BarcodesQRCodes' in result.categories and 'Beach' in result.categories, \
			f"Expected 'BarcodesQRCodes' and 'Beach' in categories, but got {result.categories}"
	
	
def test_image_single_format_query():
	query = ImageQueryParams(
		formats=['jpeg'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'jpeg' in result.format, f"Expected 'jpeg' in format, but got {result.format}"
		

def test_image_multiple_format_query():
	query = ImageQueryParams(
		formats=['jpeg', 'png'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'jpeg' in result.format or 'png' in result.format, \
			f"Expected 'jpeg' or 'png' in format, but got {result.format}"
		

def test_image_min_size_query():
	query = ImageQueryParams(
		min_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size >= 1000, f"Expected size >= 1000, but got {result.size}"
		

def test_image_max_size_query():
	query = ImageQueryParams(
		max_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size <= 1000, f"Expected size <= 1000, but got {result.size}"
		

def test_image_min_max_size_query():
	query = ImageQueryParams(
		min_size=1000,
		max_size=2000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.size <= 2000, f"Expected 1000 <= size <= 2000, but got {result.size}"
		

def test_image_min_width_query():
	query = ImageQueryParams(
		min_width=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.width >= 1000, f"Expected width >= 1000, but got {result.width}"
		

def test_image_max_width_query():
	query = ImageQueryParams(
		max_width=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.width <= 1000, f"Expected width <= 1000, but got {result.width}"


def test_image_min_max_width_query():
	query = ImageQueryParams(
		min_width=1000,
		max_width=2000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.width <= 2000, f"Expected 1000 <= width <= 2000, but got {result.width}"
		

def test_image_min_height_query():
	query = ImageQueryParams(
		min_height=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.height >= 1000, f"Expected height >= 1000, but got {result.height}"
		

def test_image_max_height_query():
	query = ImageQueryParams(
		max_height=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.height <= 1000, f"Expected height <= 1000, but got {result.height}"
		

def test_image_min_max_height_query():
	query = ImageQueryParams(
		min_height=1000,
		max_height=2000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.height <= 2000, f"Expected 1000 <= height <= 2000, but got {result.height}"


def test_image_multiple_queries():
	query = ImageQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['BarcodesQRCodes', 'Beach']),
		formats=['jpeg', 'png'],
		min_size=1000,
		max_size=20000,
		min_width=1000,
		max_width=20000,
		min_height=1000,
		max_height=20000,
	)
	
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	assert all('BarcodesQRCodes' in result.categories or 'Beach' in result.categories for result in results), \
		f"Expected 'BarcodesQRCodes' or 'Beach' in categories"
	assert all('jpeg' in result.format or 'png' in result.format for result in results), \
		f"Expected 'jpeg' or 'png' in format"
	assert all(1000 <= result.size <= 20000 for result in results), f"Expected 1000 <= size <= 2000"
	assert all(1000 <= result.width <= 20000 for result in results), f"Expected 1000 <= width <= 2000"
	assert all(1000 <= result.height <= 20000 for result in results), f"Expected 1000 <= height <= 2000"
	