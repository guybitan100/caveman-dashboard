import abc

from model.metafinder.queries import ArrayQuery


class BaseMetafinderQueryBuilder(abc.ABC):
	
	@staticmethod
	@abc.abstractmethod
	def init_query_body(count: int | None) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def categories_query(body: dict, categories: ArrayQuery) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def coins_query(body: dict, coins: list[str]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def type_query(body: dict, types: list[str]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def category_query(body: dict, category: str) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def duration_query(body: dict, min_duration: int, max_duration: int) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def formats_query(body: dict, formats: list[str]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def height_query(body: dict, min_height: int, max_height: int) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def language_query(body: dict, languages: list[str]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def os_query(body: dict, app_os: str) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def size_query(body: dict, min_size: int, max_size: int) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def width_query(body: dict, min_width: int, max_width: int) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def id_query(body: dict, ids: list[str]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def radius_query(body: dict, lat: float, lon: float, radius: int = 6500) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def radius_sort_query(body: dict, lat: float, lon: float) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def mcc_query(body: dict, mcc: list[int]) -> dict:
		pass
	
	@staticmethod
	@abc.abstractmethod
	def cctld_query(body: dict, cctld: list[str]) -> dict:
		pass

	@staticmethod
	@abc.abstractmethod
	def is_surname_query(body: dict, is_surname: bool) -> dict:
		pass
	
	
	@staticmethod
	@abc.abstractmethod
	def is_male_query(body: dict, is_male: bool) -> dict:
		pass
	
	
	@staticmethod
	@abc.abstractmethod
	def country_code_query(body: dict, country_code: str) -> dict:
		pass
	
	
	@staticmethod
	@abc.abstractmethod
	def alphabet_query(body: dict, alphabet: str) -> dict:
		pass