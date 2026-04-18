from abc import ABC, abstractmethod
from typing import  Iterator

from generation.simulation.social import SocialContext
from model.tasks import GenerationTask


class Architect[GT: GenerationTask](ABC):
    def __init__(self, context: SocialContext):
        self.context = context

    @abstractmethod
    def create_blueprints(self, n: int, params: GT) -> Iterator:
        raise NotImplementedError
