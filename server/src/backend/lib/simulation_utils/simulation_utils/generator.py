from abc import abstractmethod, ABC

class DataGenerator(ABC):

    @abstractmethod
    def generate(self, *args, **kwargs):
        raise NotImplementedError
