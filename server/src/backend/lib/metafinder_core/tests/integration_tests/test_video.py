from metafinder_core.queries import VideoQueryParams
from model.metafinder.queries import QueryOperator, ArrayQuery


def test_video_single_categories_query():
	query = VideoQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['Documents']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Documents' in result.categories, f"Expected 'Documents' in categories, but got {result.categories}"
		

def test_video_multiple_categories_or_query():
	query = VideoQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['Documents', 'BarcodesQRCodes']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Documents' in result.categories or 'BarcodesQRCodes' in result.categories, \
			f"Expected 'Documents' or 'BarcodesQRCodes' in categories, but got {result.categories}"


def test_video_multiple_categories_and_query():
	query = VideoQueryParams(
		categories=ArrayQuery(operator=QueryOperator.AND, values=['Documents', 'BarcodesQRCodes']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Documents' in result.categories and 'BarcodesQRCodes' in result.categories, \
			f"Expected 'Documents' and 'BarcodesQRCodes' in categories, but got {result.categories}"
		

def test_video_single_format_query():
	query = VideoQueryParams(
		formats=['m4v'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'm4v' in result.format, f"Expected 'm4v' in format, but got {result.format}"
		
		
def test_video_multiple_format_query():
	query = VideoQueryParams(
		formats=['m4v', 'mp4'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'm4v' in result.format or 'mp4' in result.format, \
			f"Expected 'm4v' or 'mp4' in format, but got {result.format}"
		

def test_video_min_duration_query():
	query = VideoQueryParams(
		min_duration=60,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.duration >= 60, f"Expected duration >= 60, but got {result.duration}"


def test_video_max_duration_query():
	query = VideoQueryParams(
		max_duration=60,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.duration <= 60, f"Expected duration <= 60, but got {result.duration}"
		

def test_video_min_max_duration_query():
	query = VideoQueryParams(
		min_duration=60,
		max_duration=120,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 60 <= result.duration <= 120, f"Expected 60 <= duration <= 120, but got {result.duration}"
		

def test_video_min_size_query():
	query = VideoQueryParams(
		min_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size >= 1000, f"Expected size >= 1000, but got {result.size}"
		
		
def test_video_max_size_query():
	query = VideoQueryParams(
		max_size=100000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size <= 100000, f"Expected size <= 1000, but got {result.size}"
		

def test_video_min_max_size_query():
	query = VideoQueryParams(
		min_size=1000,
		max_size=20000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.size <= 20000, f"Expected 1000 <= size <= 2000, but got {result.size}"
		

def test_video_multiple_queries():
	query = VideoQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['Documents', 'BarcodesQRCodes']),
		formats=['m4v', 'mp4'],
		min_duration=6,
		max_duration=1200,
		min_size=1000,
		max_size=200000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Documents' in result.categories or 'BarcodesQRCodes' in result.categories, \
			f"Expected 'Documents' or 'BarcodesQRCodes' in categories, but got {result.categories}"
		assert 'm4v' in result.format or 'mp4' in result.format, \
			f"Expected 'm4v' or 'mp4' in format, but got {result.format}"
		assert 6 <= result.duration <= 1200, f"Expected 60 <= duration <= 120, but got {result.duration}"
		assert 1000 <= result.size <= 200000, f"Expected 1000 <= size <= 2000, but got {result.size}"