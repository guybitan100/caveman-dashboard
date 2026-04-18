import abc
from typing import Any

from metafinder_core.queries import MetaFinderIndex
from model.metafinder.data_types import DataType

_index_mapping = {
	DataType.Image: MetaFinderIndex.Image,
	DataType.Chat: MetaFinderIndex.Chat,
	DataType.Application: MetaFinderIndex.App,
	DataType.Audio: MetaFinderIndex.Audio,
	DataType.Entity: MetaFinderIndex.Entity,
	DataType.Video: MetaFinderIndex.Video,
	DataType.Text: MetaFinderIndex.Text,
	DataType.ReportField: MetaFinderIndex.Field,
	DataType.Document: MetaFinderIndex.Document,
	DataType.CellTower: MetaFinderIndex.CellTower,
	DataType.URL: MetaFinderIndex.Url,
	DataType.Name: MetaFinderIndex.Name,
	DataType.Crypto: MetaFinderIndex.Crypto,
}


def _get_index(data_type: DataType) -> MetaFinderIndex:
	return _index_mapping.get(data_type)


class BaseQueryClient(abc.ABC):
	
	@staticmethod
	def get_data_type_index(data_type: DataType) -> MetaFinderIndex:
		return _get_index(data_type)
	
	@abc.abstractmethod
	def get_term_count(self, index: MetaFinderIndex, term: str) -> dict[str, dict[str, str | int]]:
		pass
	
	@abc.abstractmethod
	def get_term_options_range(self, index: MetaFinderIndex, options_term: str, range_term: str) -> dict[str, dict[str, int]]:
		pass
	
	@abc.abstractmethod
	def get_term_avg(self, index: MetaFinderIndex, term: str) -> dict:
		pass
	
	@abc.abstractmethod
	def get_count(self, index: MetaFinderIndex) -> int:
		pass
	
	@abc.abstractmethod
	def query(self, index: MetaFinderIndex, body: dict | str) -> Any:
		pass
	
	@abc.abstractmethod
	def get_report_fields(self,index: MetaFinderIndex, model_type: str | None = None) -> dict:
		pass