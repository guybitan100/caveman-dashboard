from abc import ABC
from typing import Any

from metafinder_core.models import MetafinderModel


class BaseMetafinderQueryResponseParser[T: MetafinderModel](ABC):

	def parse(self, response: Any, model_class: type[T]) -> list[T]:
		raise NotImplementedError("Method parse not implemented")
