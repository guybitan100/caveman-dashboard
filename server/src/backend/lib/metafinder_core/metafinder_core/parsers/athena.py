from core.titan_logger import logger
from metafinder_core.models import MetafinderModel
from metafinder_core.parsers.base import BaseMetafinderQueryResponseParser


class AthenaMetafinderQueryResponseParser[T: MetafinderModel](BaseMetafinderQueryResponseParser):
	
	def parse(self, response: list[dict], model_class: type[T]) -> list[T]:
		"""Parse the response from Athena Client"""
		items = []
		for item in response:
			try:
				items.append(model_class.model_validate(item))
			except Exception as e:
				logger.error(f"Error parsing item: {item}, error: {e}")
		return items
