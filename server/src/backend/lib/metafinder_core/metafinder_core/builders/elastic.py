from metafinder_core.builders.base import BaseMetafinderQueryBuilder
from model.metafinder.queries import ArrayQuery


class ElasticsearchMetafinderQueryBuilder(BaseMetafinderQueryBuilder):
	
	@staticmethod
	def init_query_body(count: int | None) -> dict:
		body = {
			"query": {
				"function_score": {
					"query": {
						"bool": {
							"filter": [
							],
							"must": [
							],
							"should": [
							]
						}
					},
					"random_score": {},
				}
			},
			"sort": []
		}
		if count:
			body["size"] = count
		return body
	
	@staticmethod
	def categories_query(body: dict, categories: ArrayQuery) -> dict:
		categories_filter = {
			"bool": {
				categories.operator.value: [{"term": {"categories": c}} for c in categories.values]
			}
		}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(categories_filter)
		return body

	@staticmethod
	def coins_query(body: dict, coins: list[str]) -> dict:
		coins_filter = {
			"bool": {
				"should": [{"term": {"coin": c}} for c in coins]
			}
		}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(coins_filter)
		return body

	@staticmethod
	def type_query(body: dict, types: list[str]) -> dict:
		types_filter = {
			"bool": {
				"should": [{"term": {"type": c}} for c in types]
			}
		}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(types_filter)
		return body

	@staticmethod
	def category_query(body: dict, category: str) -> dict:
		categories_filter = {"match": {"category": {"query": category}}}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(categories_filter)
		return body

	@staticmethod
	def duration_query(body: dict, min_duration: int, max_duration: int) -> dict:
		width_filter = {"range": {"duration": {"boost": 2.0}}}
		if max_duration:
			width_filter["range"]["duration"]["lte"] = max_duration
		if min_duration:
			width_filter["range"]["duration"]["gte"] = min_duration
		body["query"]["function_score"]["query"]["bool"]["filter"].append(width_filter)
		return body

	@staticmethod
	def formats_query(body: dict, formats: list[str]) -> dict:
		format_filter = {"terms": {"format": formats}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(format_filter)
		return body

	@staticmethod
	def height_query(body: dict, min_height: int, max_height: int) -> dict:
		height_filter = {"range": {"height": {"boost": 2.0}}}
		if max_height:
			height_filter["range"]["height"]["lte"] = max_height
		if min_height:
			height_filter["range"]["height"]["gte"] = min_height
		
		body["query"]["function_score"]["query"]["bool"]["filter"].append(height_filter)
		return body

	@staticmethod
	def language_query(body: dict, languages: list[str]) -> dict:
		language_filter = {"terms": {"language": languages}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(language_filter)
		return body

	@staticmethod
	def os_query(body: dict, app_os: str) -> dict:
		os_filter = {"match": {"os": {"query": app_os}}}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(os_filter)
		return body

	@staticmethod
	def size_query(body: dict, min_size: int, max_size: int) -> dict:
		size_filter = {"range": {"size": {"boost": 2.0}}}
		if max_size:
			size_filter["range"]["size"]["lte"] = max_size
		if min_size:
			size_filter["range"]["size"]["gte"] = min_size
		body["query"]["function_score"]["query"]["bool"]["filter"].append(size_filter)
		return body

	@staticmethod
	def width_query(body: dict, min_width: int, max_width: int) -> dict:
		width_filter = {"range": {"width": {"boost": 2.0}}}
		if max_width:
			width_filter["range"]["width"]["lte"] = max_width
		if min_width:
			width_filter["range"]["width"]["gte"] = min_width
		
		body["query"]["function_score"]["query"]["bool"]["filter"].append(width_filter)
		return body

	@staticmethod
	def id_query(body: dict, ids: list[str]):
		id_filter = {"terms": {"_id": ids}}
		body["query"]["function_score"]["query"]["bool"]["filter"].append(id_filter)
		return body

	@staticmethod
	def radius_query(body: dict, lat: float, lon: float, radius: int = 6500) -> dict:
		radius_filter = {
			"geo_distance": {
				"distance": f"{radius}km",
				"location": {
					"lat": lat,
					"lon": lon
				}
			}
		}
		
		body["query"]["function_score"]["query"]["bool"]["filter"].append(radius_filter)
		return body

	@staticmethod
	def radius_sort_query(body: dict, lat: float, lon: float) -> dict:
		radius_sort = {
			"_geo_distance": {
				"location": {
					"lat": lat,
					"lon": lon
				},
				"order": "asc",
				"unit": "km"
			}
		}
		body["sort"].append(radius_sort)
		return body

	@staticmethod
	def mcc_query(body: dict, mcc: list[int]) -> dict:
		mcc_filter = {"terms": {"mcc": mcc}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(mcc_filter)
		return body

	@staticmethod
	def cctld_query(body: dict, cctld: list[str]) -> dict:
		format_filter = {"terms": {"cctld": cctld}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(format_filter)
		return body
	
	@staticmethod
	def is_surname_query(body: dict, is_surname: bool) -> dict:
		surname_filter = {"match": {"is_surname": {"query": is_surname}}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(surname_filter)
		return body
	
	@staticmethod
	def is_male_query(body: dict, is_male: bool) -> dict:
		gte_or_lt = 'gte' if is_male else 'lt'
		male_filter = {"range": {"male_prob": {gte_or_lt: 0.5}}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(male_filter)
		return body
	
	@staticmethod
	def country_code_query(body: dict, country_code: str) -> dict:
		country_filter = {"match": {"country_code": {"query": country_code.upper()}}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(country_filter)
		return body
	
	@staticmethod
	def alphabet_query(body: dict, alphabet: str) -> dict:
		alphabet_filter = {"match": {"alphabet": {"query": alphabet}}}
		body["query"]["function_score"]["query"]["bool"]["must"].append(alphabet_filter)
		return body