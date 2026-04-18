from metafinder_core.builders.base import BaseMetafinderQueryBuilder
from model.metafinder.queries import ArrayQuery, QueryOperator


class AthenaMetafinderQueryBuilder(BaseMetafinderQueryBuilder):
	
	@staticmethod
	def init_query_body(count: int | None) -> dict:
		body = {
			"select": "*",
			"where": [],
			"order_by": None,
			"with": None,
			"join": None,
			"limit": None
		}
		if count:
			body["limit"] = count
		return body
	
	@staticmethod
	def cctld_query(body: dict, cctld: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"cctld = '{c}'" for c in cctld])})")
		return body
	
	@staticmethod
	def mcc_query(body: dict, mcc: list[int]) -> dict:
		body["where"].append(f"({' OR '.join([f"mcc = {m}" for m in mcc])})")
		return body
	
	@staticmethod
	def radius_query(body: dict, lat: float, lon: float, radius: int = 650) -> dict:
		radius_filter = f"ST_Distance(ST_Point(location.lon, location.lat), ST_Point({lon}, {lat})) <= {radius}"
		body["where"].append(radius_filter)
		return body
	
	@staticmethod
	def radius_sort_query(body: dict, lat: float, lon: float) -> dict:
		radius_sort = f"ST_Distance(ST_Point(location.lon, location.lat), ST_Point({lon}, {lat})) ASC"
		body["order_by"] = radius_sort
		return body
	
	@staticmethod
	def id_query(body: dict, ids: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"id = '{_id}'" for _id in ids])})")
		return body
	
	@staticmethod
	def width_query(body: dict, min_width: int, max_width: int) -> dict:
		if min_width:
			body["where"].append(f"width >= {min_width}")
		if max_width:
			body["where"].append(f"width <= {max_width}")
		return body
	
	@staticmethod
	def size_query(body: dict, min_size: int, max_size: int) -> dict:
		if min_size:
			body["where"].append(f"size >= {min_size}")
		if max_size:
			body["where"].append(f"size <= {max_size}")
		return body
	
	@staticmethod
	def os_query(body: dict, app_os: str) -> dict:
		body["where"].append(f"os = '{app_os}'")
		return body
	
	@staticmethod
	def language_query(body: dict, languages: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"language = '{lang}'" for lang in languages])})")
		return body
	
	@staticmethod
	def height_query(body: dict, min_height: int, max_height: int) -> dict:
		if min_height:
			body["where"].append(f"height >= {min_height}")
		if max_height:
			body["where"].append(f"height <= {max_height}")
		return body
	
	@staticmethod
	def formats_query(body: dict, formats: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"format = '{format}'" for format in formats])})")
		return body
	
	@staticmethod
	def duration_query(body: dict, min_duration: int, max_duration: int) -> dict:
		if min_duration:
			body["where"].append(f"duration >= {min_duration}")
		if max_duration:
			body["where"].append(f"duration <= {max_duration}")
		return body
	
	@staticmethod
	def category_query(body: dict, category: str) -> dict:
		body["where"].append(f"({' OR '.join([f"contains(category, '{cat}')" for cat in category])})")
		return body
	
	@staticmethod
	def type_query(body: dict, types: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"type = '{type}'" for type in types])})")
		return body
	
	@staticmethod
	def coins_query(body: dict, coins: list[str]) -> dict:
		body["where"].append(f"({' OR '.join([f"coin = '{coin}'" for coin in coins])})")
		return body
	
	@staticmethod
	def categories_query(body: dict, categories: ArrayQuery) -> dict:
		operator = "AND" if categories.operator == QueryOperator.AND else "OR"
		body["where"].append(f"({f' {operator} '.join([f"contains(categories, '{category}')" for category in categories.values])})")
		return body
	
	@staticmethod
	def is_surname_query(body: dict, is_surname: bool) -> dict:
		body["where"].append(f"is_surname = {str(is_surname).lower()}")
		return body
	
	@staticmethod
	def is_male_query(body: dict, is_male: bool) -> dict:
		gte_or_lt = '>=' if is_male else '<'
		body["where"].append(f"male_prob {gte_or_lt} 0.5")
		return body
	
	@staticmethod
	def country_code_query(body: dict, country_code: str) -> dict:
		body["where"].append(f"country_code = '{country_code.upper()}'")
		return body
	
	@staticmethod
	def alphabet_query(body: dict, alphabet: str) -> dict:
		body["where"].append(f"alphabet = '{alphabet}'")
		return body
	
	@staticmethod
	def report_field_query(body: dict, model_type: str | None = None) -> dict:
		body["with"] = "VERSION_RANKING AS (SELECT version, ROW_NUMBER() OVER (ORDER BY version DESC) AS rank FROM metafinder.fields_index GROUP BY version)"
		return body