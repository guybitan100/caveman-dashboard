import asyncio
from functools import wraps
from pathlib import Path
from typing import Callable, Dict, List, Optional, Union, Iterator, Coroutine, Any
import aiohttp
import requests

from pydantic import BaseModel
from requests import HTTPError
from requests.adapters import HTTPAdapter
from urllib3 import Retry
from dependency_injector import containers, providers
from dependency_injector.wiring import Provide

from core.s3_client import SixS3Client
from core.config import SETTINGS
from model.metafinder.queries import QueryOperator, ArrayQuery
from core.six_logger import logger
from model.metafinder.data_types import DataType, KeywordTerms, RangeTerms, data_type_count_limit
from metafinder_core.models import AppModel, AudioModel, ChatModel, DocumentModel, ImageModel, ReportModelField, \
    TextModel, VideoModel, CellTowerModel, UrlModel, LocalizedNameModel, CryptoModel, MetafinderModel


class MetaFinderError(Exception):
	pass


def _handle_metafinder_errors(func: Callable) -> Callable:
	"""Decorator method for auto-handling MetaFinder connection and response errors"""

	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			return func(*args, **kwargs)
		except MetaFinderError as e:
			raise e
		except HTTPError as e:
			raise MetaFinderError("MetaFinder connection problem") from e
		except Exception as e:
			raise MetaFinderError(f"Error in handling MetaFinder response: {e}") from e

	return wrapper


class Container(containers.DeclarativeContainer):

	config = providers.Configuration()

	s3_client = providers.Factory(SixS3Client)


class MetaFinderClient:
	def __init__(self, host: str = SETTINGS.METAFINDER_HOST):
		self._url = host

	def get_count(
			self,
			data_type: DataType,
			is_categories_and_op: bool = None,
			categories: Optional[List[str]] = None,
			**kwargs
	) -> int:
		logger.debug(f"Requesting count for {data_type.value} from MetaFinder", data_type=data_type.value)

		if categories:
			kwargs['categories'] = _get_array_query(values=categories, is_and_operator=is_categories_and_op)

		queries = {param: _parse_query(value) for param, value in kwargs.items() if value is not None}

		body = {
			"data_type": data_type.value,
			"queries": queries,
		}

		data = self._get_response(url=f"{self._url}/count", data=body)

		return data

	def get_images(
		self,
		count: int,
		categories: Optional[List[str]] = None,
		min_width: Optional[int] = None,
		max_width: Optional[int] = None,
		min_height: Optional[int] = None,
		max_height: Optional[int] = None,
		is_categories_and_op: bool = None,
		formats: Optional[List[str]] = None,
		**kwargs,
	) -> Iterator[ImageModel]:
		"""
		Attributes:
			count (int):
			categories (Optional[List[str]):    List of analytical categories to query MetaFinder by.
			min_width (Optional[int]):
			max_width (Optional[int]):
			min_height (Optional[int]):
			max_height (Optional[int]):
			is_categories_and_op (bool):        When set to True, queries categories with AND operator.

		Returns:
			Iterator of image Model.
		"""
		images = self._get_data(data_type=DataType.Image, count=count, data_class=ImageModel,
								min_width=min_width, max_width=max_width, min_height=min_height, max_height=max_height,
								categories=_get_array_query(values=categories, is_and_operator=is_categories_and_op),
								formats=formats, **kwargs)
		return images

	def get_audios(
			self,
			count: int,
			categories: Optional[List[str]] = None,
			min_duration: Optional[int] = None,
			max_duration: Optional[int] = None,
			is_categories_and_op: bool = False,
			formats: List[str] = None,
			**kwargs
	) -> Iterator[AudioModel]:
		"""
		Attributes:
			count (int):
			categories (Optional[List[str]]):   List of analytical categories to query MetaFinder by.
			min_duration (Optional[int]):
			max_duration (Optional[int]):
			is_categories_and_op (bool):        When set to True, queries categories with AND operator.
			formats(List[str]):                 File extensions by which to filter audios

		Returns:
			Iterator of audio Model.
		"""
		audios = self._get_data(data_type=DataType.Audio, count=count, data_class=AudioModel,
								categories=_get_array_query(values=categories, is_and_operator=is_categories_and_op),
								min_duration=min_duration, max_duration=max_duration, formats=formats, **kwargs)
		return audios

	def get_videos(
			self,
			count: int,
			categories: Optional[List[str]] = None,
			min_duration: Optional[int] = None,
			max_duration: Optional[int] = None,
			formats: List[str] = None,
			is_categories_and_op: bool = False,
			**kwargs
	) -> Iterator[VideoModel]:
		"""
		Attributes:
			count (int):
			categories (Optional[List[str]]):   List of analytical categories to query MetaFinder by.
			min_duration (Optional[int]):       Minimum video duration
			max_duration (Optional[int]):       Maximum video duration
			formats(List[str]):                 File extensions by which to filter videos
			is_categories_and_op (bool):        When set to True, queries categories with AND operator.

		Returns:
			Iterator of video Model.
		"""
		videos = self._get_data(data_type=DataType.Video, count=count, data_class=VideoModel,
								categories=_get_array_query(values=categories, is_and_operator=is_categories_and_op),
								min_duration=min_duration, max_duration=max_duration, formats=formats, **kwargs)
		return videos

	def get_sentences(
			self,
			count: int,
			languages: Optional[List[str]] = None,
			categories: Optional[List[str]] = None,
			is_categories_and_op: bool = False,
			**kwargs
	) -> Iterator[ChatModel]:
		"""
		Attributes:
			count (int):
			language (Optional[str]):           Language code to query MetaFinder by.
			categories (Optional[List[str]]):   List of analytical categories to query MetaFinder by.
			is_categories_and_op (bool):        When set to True, queries categories with AND operator.

		Returns:
			Iterator of chat Model.
		"""
		messages = self._get_data(data_type=DataType.Chat, count=count,
								  data_class=ChatModel, languages=languages,
								  categories=_get_array_query(values=categories, is_and_operator=is_categories_and_op),
								  **kwargs)
		return messages

	def get_urls(
			self,
			count: int,
			cctld: Optional[str] = None,
			categories: Optional[List[str]] = None,
			is_categories_and_op: bool = False,
			**kwargs
	) -> Iterator[UrlModel]:
		"""
		Attributes:
			count (int):
			cctld (Optional[str]):              Country code Tld to query MetaFinder by.
			categories (Optional[List[str]]):   List of analytical categories to query MetaFinder by.
			is_categories_and_op (bool):        When set to True, queries categories with AND operator.

		Returns:
			Iterator of URL Model.
		"""
		urls = self._get_data(data_type=DataType.URL, count=count,
							  data_class=UrlModel, cctld=cctld,
							  categories=_get_array_query(values=categories, is_and_operator=is_categories_and_op),
							  **kwargs)
		return urls

	def get_apps(
		self,
		count: int,
		os: Optional[str] = None,
		category: Optional[str] = None,
		**kwargs,
	) -> Iterator[AppModel]:
		"""
		Attributes:
			count (int):
			os (Optional[str]):         Application Operating System.
			category (Optional[str]):   Application app store category.

		Returns:
			Iterator of application Model.
		"""
		apps = self._get_data(
			data_type=DataType.Application,
			count=count,
			data_class=AppModel,
			os=os,
			category=category,
			**kwargs,
		)
		return apps

	def get_text(self, count: int, category: Optional[str] = None, **kwargs) -> Iterator[TextModel]:
		"""
		Attributes:
			count(int):
			category(Optional[str]): analytical category to query MetaFinder by.

		Returns:
			Iterator of text Model.
		"""
		texts = self._get_data(
			data_type=DataType.Text,
			count=count,
			data_class=TextModel,
			categories=category,
			**kwargs,
		)
		return texts

	def get_cell_towers(
			self,
			count: int,
			latitude: float = None,
			longitude: float = None,
			mcc: int = None,
			**kwargs
	) -> Iterator[CellTowerModel]:
		"""
		Attributes:
			count(int):
			latitude(float):    Latitude of coordinate that cell towers will be sorted by distance to.
			latitude(float):    Latitude of coordinate that cell towers will be sorted by distance to.
			mcc(int):           MCC of the cell towers.
		Returns:
			Iterator of CellTowerModel.
		"""
		cell_towers = self._get_data(
			data_type=DataType.CellTower,
			count=count,
			data_class=CellTowerModel,
			lat=latitude,
			lon=longitude,
			mcc=mcc,
			**kwargs,
		)
		return cell_towers

	def get_documents(
		self,
		count: int,
		min_size: Optional[int] = None,
		max_size: Optional[int] = None,
		format: Optional[str] = None,
		**kwargs,
	) -> Iterator[DocumentModel]:
		"""
		Attributes:
			count (int):
			min_size (Optional[int]):   Minimum size of file in bytes.
			max_size (Optional[int]):   Maximum size of file in bytes.
			format (Optional[str]):     File extension.

		Returns:
			Iterator of documents Model.
		"""
		texts = self._get_data(
			data_class=DocumentModel,
			data_type=DataType.Document,
			count=count,
			min_size=min_size,
			max_size=max_size,
			format=format,
			**kwargs,
		)
		return texts

	def get_names(
			self,
			count: int,
			is_surname: Optional[bool] = None,
			is_male: Optional[bool] = None,
			country_code: Optional[str] = None,
			alphabet: Optional[str] = None,
			**kwargs
	) -> Iterator[LocalizedNameModel]:
		"""
		Attributes:
			count (int):
			is_surname (bool):              Retrieve surnames, else first names
			is_male (bool): If True, retrieve names that are more commonly male, else if False female, otherwise either
			country_code (Optional[str]):   Country code

		Returns:
			List of names
		"""
		names = self._get_data(
			data_type=DataType.Name,
			count=count,
			data_class=LocalizedNameModel,
			is_surname=is_surname,
			is_male=is_male,
			country_code=country_code,
			alphabet=alphabet,
			**kwargs
		)
		return names

	def get_crypto(
			self,
			count: int,
			types: Optional[List[str]] = None,
			languages: Optional[List[str]] = None,
			coins: Optional[List[str]] = None,
			**kwargs
	) -> Iterator[CryptoModel]:
		"""
		Attributes:
			count (int):
			types (Optional[List[str]]):        Type of crypto artifact (wallet, transaction, nmemonic, etc.)
			languages (Optional[List[str]]):    Language of crypto artifact (if applicable)
			coins (Optional[List[str]]):        Coin type (BTC, ETH, etc.)

		Returns:
			Iterator of crypto artifacts
		"""
		crypto = self._get_data(
			data_type=DataType.Crypto,
			count=count,
			data_class=CryptoModel,
			types=types,
			languages=languages,
			coins=coins,
			**kwargs
		)
		return crypto
	
	def _get_data[T: MetafinderModel](
			self,
			data_type: DataType,
			count: int,
			data_class: type[T] = None,
			**kwargs,
	) -> Iterator[T]:
		
		if count <= 0:
			return
		
		logger.debug(f"Requesting {count} {data_type.value} records from MetaFinder", data_type=data_type.value, count=count)
		
		chunk_size = data_type_count_limit.get(data_type, SETTINGS.METAFINDER_MAX_ITEMS)
		tasks = []
		for chunk_start in range(0, count, chunk_size):
			chunk_count = min(chunk_size, count - chunk_start)
			tasks.append(self._fetch_request(data_type=data_type, chunk_count=chunk_count, **kwargs))
		
		results = asyncio.run(self._fetch_data(tasks))
		
		for data in results:
			if data_class is not None:  # MF Model objects (Pydantic)
				for data_dict in data:
					yield data_class.model_validate(data_dict)
			else:  # raw dicts
				yield from data
				
	async def _fetch_data(self, tasks: List[Coroutine[Any, Any, list[dict]]]) -> List[List[Dict]]:
		return await asyncio.gather(*tasks)
	
	async def _fetch_request(
			self,
			data_type: DataType,
			chunk_count: int,
			**kwargs,) -> List[Dict]:
		async with asyncio.Semaphore(SETTINGS.METAFINDER_CLIENT_MAX_CONCURRENCY):
			async with aiohttp.ClientSession() as session:
				body = {
					'data_type': data_type.value,
					'count': chunk_count,
					'queries': {
						param: _parse_query(value) for param, value in kwargs.items() if value is not None
					}
				}
				async with session.post(url=f"{self._url}/data", json=body) as response:
					response.raise_for_status()
					data = await response.json()
					if not isinstance(data, list) or not data:
						raise MetaFinderError(
							f"MetaFinder returned no results, requested count={chunk_count} "
							f"(type={data_type.value}, queries={kwargs})"
						)
					return data

	@staticmethod
	@_handle_metafinder_errors
	def _get_response(url: str, data: Optional[Dict] = None):
		"""Returns JSON content of POST response"""
		session = requests.Session()
		retries = Retry(total=5, backoff_factor=2)
		adapter = HTTPAdapter(max_retries=retries)
		session.mount("https://", adapter)
		session.mount("http://", adapter)
		response = session.post(url=url, json=data)
		response.raise_for_status()
		data = response.json()
		return data

	@_handle_metafinder_errors
	def get_apps_by_app_ids(self, app_ids: List[str]) -> List[AppModel]:
		"""
		Get Applications objects by their app_ids.

		Attributes:
			app_ids (List[str]): List of app ids

		Returns:
			List of application Model.
		"""
		if not app_ids:
			return []

		body = {
			"count": len(app_ids),
			"data_type": DataType.Application.value,
			"queries": {"app_ids": app_ids},
		}

		logger.debug(f"Requesting {len(app_ids)} app Model records from MetaFinder", count=len(app_ids))
		response = self._get_response(f"{self._url}/data", body)
		logger.debug(f"Received {len(response)} app Model records from MetaFinder", count=len(response))
		apps = [AppModel.model_validate(app) for app in response]

		# Log warning if requested apps counts doesn't equal received count
		if len(app_ids) != len(apps):
			missing_apps = set(app_ids) - set([app.app_id for app in apps])  # Set difference
			logger.warn(
				f"Only received {len(apps)} of {len(app_ids)} requested apps from MetaFinder. "
				f'Missing app IDs: {",".join(missing_apps)}', requested_count=len(app_ids), received_count=len(apps),
				missing_apps=missing_apps
			)

		return apps

	def get_chat_message_languages(self) -> Dict[str, Dict[str, int]]:
		"""
		Returns:
			Dict[str, Dict[str, int]]: {lang: {lang: count}}
		"""
		return self.get_field_counts_by_data_key(data_type=DataType.Chat, data_key="language")

	def get_categories(self, data_type: DataType) -> Dict[str, Dict[str, int]]:
		"""
		Returns:
			Dict[str, Dict[str, int]]: {category: {category: count}}
		"""
		return self.get_field_counts_by_data_key(data_type=data_type, data_key="categories")

	def get_formats(self, data_type: DataType) -> Dict[str, Dict[str, int]]:
		"""
		Returns:
			 Dict[str, Dict[str, int]]: {format: {format: count}}
		"""
		return self.get_field_counts_by_data_key(data_type=data_type, data_key="format")

	def get_field_counts_by_data_key(self, data_type: DataType, data_key: str):
		"""
		Returns:
			Dict[str, Dict[str, int]]: {data_key: {data_key: count}}
		"""
		return self._get_response(f"{self._url}/count/{data_type.value}/term/{data_key}")

	def get_report_event_fields(self) -> List[ReportModelField]:
		"""
		Returns:
			List of report.xml fields.
		"""
		data = self._get_data(data_type=DataType.ReportField, count=1)
		fields = [ReportModelField.model_validate(field) for field in data]
		return fields

	def get_term_options(self, data_type: DataType, term: KeywordTerms) -> Dict[str, Dict[str, int]]:
		"""
		Returns:
			Dict[str, Dict[str, int]]: {lang: {lang: count}}
		"""
		formats_counts = self._get_response(f"{self._url}/count/{data_type.value}/term/{term.value}")
		return formats_counts

	def get_term_options_range(
		self, data_type: DataType, term: KeywordTerms, range: RangeTerms
	) -> Dict[str, Dict[str, int]]:
		"""
		Returns:
			Dict[str, Dict[str, int]]: {format: {max: count, min: count}}
		"""
		formats_max_min_counts = self._get_response(
			f"{self._url}/count/{data_type.value}/term/{term.value}/range/{range.value}"
		)
		return formats_max_min_counts

	def get_term_average(self, data_type: DataType, term: RangeTerms) -> int:
		"""
		Returns:
			int
		"""
		return self._get_response(f"{self._url}/avg/{data_type.value}/term/{term.value}")

	@_handle_metafinder_errors
	def get_all_apps(self) -> List[AppModel]:

		body = {
			"data_type": DataType.Application.value,
			"count": 1000,
			"queries": {},
		}

		data = self._get_response(url=f"{self._url}/data", data=body)
		return [AppModel.model_validate(app) for app in data]

	@_handle_metafinder_errors
	def download_file(self,
					  s3_key: str,
					  filepath: Union[str, Path],
					  s3_client: SixS3Client = Provide[Container.s3_client]
					  ):
		s3_client.download_file(bucket_name=SETTINGS.BUCKET_NAME, s3_key=s3_key, file_name=str(filepath))


def _parse_query(data: Any) -> str | dict[str, str]:
	if isinstance(data, BaseModel):
		return data.dict()
	return data


def _get_array_query(values, is_and_operator) -> ArrayQuery | None:
	if values:
		if is_and_operator:
			return ArrayQuery(values=values, operator=QueryOperator.AND)
		return ArrayQuery(values=values, operator=QueryOperator.OR)
	return None
