import itertools
from typing import Iterator

import numpy as np

from core.titan_logger import logger
from simulation_utils.generator import DataGenerator
from metafinder_core.queries import UrlQueryParams, MetaFinderQueryError
from model.metafinder.queries import ArrayQuery
from model.country_info import CountryInfo
from metafinder_core.models import UrlModel


class UrlGenerator(DataGenerator):
    def generate(
            self,
            n: int,
            categories: list[str] = None,
            country_info: CountryInfo = None,
    ) -> Iterator[str]:

        if not country_info or not country_info.tlds:
            url_metadatas = UrlQueryParams(categories=ArrayQuery(values=categories)).query(count=n)
        else:
            cctlds = [*list(country_info.tlds), None]
            distributions = map(int, np.random.multinomial(n, [1 / len(cctlds)] * len(cctlds), size=1)[0])

            url_metadatas = itertools.chain.from_iterable(
                self._get_urls(
                    count=count,
                    cctld=[cctld] if cctld else None,
                    categories=categories
                )
                for cctld, count in zip(cctlds, distributions)
            )

        for url_metadata in url_metadatas:
            yield url_metadata.url

    @staticmethod
    def _get_urls(count: int, cctld: str | None, categories: list[str] | None) -> Iterator[UrlModel]:
        try:
            yield from UrlQueryParams(
                cctld=[cctld] or [],
                categories=ArrayQuery(values=categories)
            ).query(count=count)
        except MetaFinderQueryError:
            logger.debug(f'Error getting URL for CCTld {cctld}' + ' - Trying again without' if cctld else '', cctld=cctld)
            if cctld:
                yield from UrlQueryParams(
                    cctld=[],
                    categories=ArrayQuery(values=categories)
                ).query(count=count)
