from metafinder_core.queries import AudioQueryParams
from model.metafinder.queries import QueryOperator, ArrayQuery


def test_audio_single_categories_query():
	query = AudioQueryParams(
		categories=ArrayQuery(values=['Speech']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Speech' in result.categories, f"Expected 'Speech' in categories, but got {result.categories}"
		

def test_audio_multiple_categories_or_query():
	query = AudioQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['Speech', 'Music']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Speech' in result.categories or 'Music' in result.categories, \
			f"Expected 'Speech' or 'Music' in categories, but got {result.categories}"


def test_audio_multiple_categories_and_query():
	query = AudioQueryParams(
		categories=ArrayQuery(operator=QueryOperator.AND, values=['Speech', 'Music']),
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Speech' in result.categories and 'Music' in result.categories, \
			f"Expected 'Speech' and 'Music' in categories, but got {result.categories}"
		

def test_audio_single_format_query():
	query = AudioQueryParams(
		formats=['wav'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'wav' in result.format, f"Expected 'wav' in format, but got {result.format}"
		
		
def test_audio_multiple_format_query():
	query = AudioQueryParams(
		formats=['wav', 'mp3'],
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'wav' in result.format or 'mp3' in result.format, \
			f"Expected 'wav' or 'mp3' in format, but got {result.format}"
		

def test_audio_min_duration_query():
	query = AudioQueryParams(
		min_duration=60,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.duration >= 60, f"Expected duration >= 60, but got {result.duration}"


def test_audio_max_duration_query():
	query = AudioQueryParams(
		max_duration=60,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.duration <= 60, f"Expected duration <= 60, but got {result.duration}"
		

def test_audio_min_max_duration_query():
	query = AudioQueryParams(
		min_duration=60,
		max_duration=120,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 60 <= result.duration <= 120, f"Expected 60 <= duration <= 120, but got {result.duration}"
		

def test_audio_min_size_query():
	query = AudioQueryParams(
		min_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size >= 1000, f"Expected size >= 1000, but got {result.size}"
		
		
def test_audio_max_size_query():
	query = AudioQueryParams(
		max_size=1000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert result.size <= 1000, f"Expected size <= 1000, but got {result.size}"
		

def test_audio_min_max_size_query():
	query = AudioQueryParams(
		min_size=1000,
		max_size=2000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 1000 <= result.size <= 2000, f"Expected 1000 <= size <= 2000, but got {result.size}"
		

def test_audio_multiple_queries():
	query = AudioQueryParams(
		categories=ArrayQuery(operator=QueryOperator.OR, values=['Speech', 'Music']),
		formats=['wav', 'mp3'],
		min_duration=6,
		max_duration=1200,
		min_size=1000,
		max_size=20000,
	)
	results = query.query(10)
	
	assert len(results) == 10, f"Expected 10 results, but got {len(results)}"
	for result in results:
		assert 'Speech' in result.categories or 'Music' in result.categories, \
			f"Expected 'Speech' or 'Music' in categories, but got {result.categories}"
		assert 'wav' in result.format or 'mp3' in result.format, \
			f"Expected 'wav' or 'mp3' in format, but got {result.format}"
		assert 6 <= result.duration <= 1200, f"Expected 60 <= duration <= 120, but got {result.duration}"
		assert 1000 <= result.size <= 20000, f"Expected 1000 <= size <= 2000, but got {result.size}"