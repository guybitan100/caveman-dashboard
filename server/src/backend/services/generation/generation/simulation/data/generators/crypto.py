import random
from typing import Iterator

from simulation_utils.generator import DataGenerator
from metafinder_core.models import CryptoModel
from metafinder_core.queries import CryptoQueryParams


BATCH_SIZE = 1000


class CryptoGenerator(DataGenerator):
    def __init__(self):
        self._artifacts = self._get_artifacts()

    def _get_artifacts(self) -> Iterator[CryptoModel]:
        yield from CryptoQueryParams().query(count=BATCH_SIZE)

    def _generate(self) -> CryptoModel:
        try:
            artifact = next(self._artifacts)
        except StopIteration:
            self._artifacts = self._get_artifacts()
            artifact = next(self._artifacts)
        return artifact

    def generate(self, n: int) -> Iterator[CryptoModel]:
        """
        Generate crypto artifacts.

        Arguments:
            n: The number of artifacts to generate.
        """
        yield from (self._generate() for _ in range(n))

    def enrich_string(self, input_string: str) -> str:
        """
        Enrich a string with a crypto artifact.
        If the crypto artifact is a mnemonic, replace the string with the artifact value.
        Else add the artifact value in a random position in the string.

        Arguments:
            input_string: The string to enrich.
        """
        artifact = self._generate()

        if artifact.type == "mnemonic":
            return artifact.value
        else:
            position = random.randint(0, len(input_string))
            # Add the artifact value in the random position
            return input_string[:position] + artifact.value + input_string[position:]
