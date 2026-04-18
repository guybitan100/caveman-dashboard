from abc import abstractmethod, ABC


class DataGenerator(ABC):
    """Abstract class for data generators"""

    @abstractmethod
    def generate(self, *args, **kwargs):
        """Abstract generation method"""
        raise NotImplementedError
