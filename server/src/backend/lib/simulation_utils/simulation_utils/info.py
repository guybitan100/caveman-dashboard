from dataclasses import dataclass
from itertools import groupby, chain
from typing import Iterator
import warnings

from faker import Faker
from faker.config import AVAILABLE_LOCALES

from core.titan_logger import logger
from metafinder_core.queries import NameQueryParams, MetaFinderQueryError
from model.country_info import CountryInfo
from metafinder_core.models import LocalizedNameModel
from simulation_utils.generator import DataGenerator

# Ignore the specific UserWarning about fr_QC locale
warnings.filterwarnings("ignore", message="fr_QC locale is deprecated. Please use fr_CA.")

@dataclass
class GeneratedPersonalInfo:
    first_name: str
    last_name: str
    phone: str
    email: str
    male_prob: float

class PersonalInfoGenerator(DataGenerator):
    def __init__(self, country_info: CountryInfo | None = None):
        self._faker = Faker(locale=self._get_locales_by_country_info(country_info=country_info))
        self._country_code = None if country_info is None else country_info.code

    def generate(self, n: int, **kwargs) -> Iterator[GeneratedPersonalInfo]:
        country_code = self._country_code
        try:
            first_names = self._get_first_names(count=n, country_code=country_code)
        except MetaFinderQueryError as e:
            logger.warn(f'MetaFinder error retrieving first names for country code "{country_code}", '
                                    f'trying again with no country code. Error: {e}', error=e, country_code=country_code)
            first_names = self._get_first_names(count=n)
            country_code = None     # Reset country code for future surname query to MetaFinder
        grouped_first_names = [list(group) for _, group in groupby(first_names, lambda x: x.alphabet)]

        grouped_last_names = [
            self._get_last_names(
                count=(len(first_names_group)),
                country_code=country_code,
                alphabet=first_names_group[0].alphabet
            )
            for first_names_group in grouped_first_names
        ]

        phones = self.generate_phone_numbers(n=n)
        emails = self.generate_emails(n=n)

        persons = (
            GeneratedPersonalInfo(
                first_name=first_name.name,
                last_name=last_name,
                phone=phone,
                email=email,
                male_prob=first_name.male_prob)
            for first_name, last_name, phone, email
            in zip(list(chain(*grouped_first_names)), list(chain(*grouped_last_names)), phones, emails)
        )

        yield from persons

    @staticmethod
    def _get_first_names(count: int, country_code: str | None = None) -> list[LocalizedNameModel]:
        first_names = NameQueryParams(is_surname=False, country_code=country_code).query(count)
        sorted_first_names = sorted(first_names, key=lambda x: x.alphabet)
        return sorted_first_names

    @staticmethod
    def _get_last_names(count: int, country_code: str | None = None, alphabet: str | None = None) -> list[str]:
        try:
            names = [
                name.name
                for name in NameQueryParams(is_surname=True, country_code=country_code, alphabet=alphabet).query(count)
            ]
        except MetaFinderQueryError:
            logger.debug(f'MetaFinder error retrieving surnames for alphabet "{alphabet}"', alphabet=alphabet)
            names = [""] * count
        return names

    def generate_phone_numbers(self, n: int) -> list[str]:
        return [self._faker.phone_number() for _ in range(n)]

    def generate_emails(self, n: int) -> list[str]:
        return [self._faker.ascii_safe_email() for _ in range(n)]

    @staticmethod
    def _get_locales_by_country_info(country_info: CountryInfo | None) -> list[str]:
        if country_info is None:
            return AVAILABLE_LOCALES
        locales = list(filter(lambda locale: locale.endswith(country_info.code), AVAILABLE_LOCALES))
        locales = locales or AVAILABLE_LOCALES      # if locales are empty, sample from all available
        return locales
