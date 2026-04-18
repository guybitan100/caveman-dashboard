import asyncio
import json
from dataclasses import dataclass
from time import sleep

import aioboto3
from types_aiobotocore_lambda import LambdaClient

from core.config import SETTINGS
from core.titan_logger import logger
from simulation_utils.generator import DataGenerator
from generation.utils import invoke_function, LambdaException

MAX_CONCURRENCY = 10
MAX_RETRIES = 2


@dataclass
class GeneratedLocationThumbnail:
    path: str
    md5: str
    size: int


@dataclass
class LocationThumbnailParam:
    latitude: float
    longitude: float


class LocationThumbnailsGenerator(DataGenerator):
    def  generate(self, location_data: list[LocationThumbnailParam], job_id: str, **kwargs) -> list[GeneratedLocationThumbnail]:
        return asyncio.run(self.generate_async(location_data, job_id, **kwargs))
    
    async def generate_async(self, location_data: list[LocationThumbnailParam], job_id: str, **kwargs) \
            -> list[GeneratedLocationThumbnail]:
        requested_amount = len(location_data)
        logger.info(f'Generating {requested_amount} thumbnails')
        session = aioboto3.Session()
        async with session.client('lambda', region_name=SETTINGS.AWS_REGION) as lambda_client:
            async with asyncio.Semaphore(MAX_CONCURRENCY):
                thumbnails = [await self._generate_thumbnail(location=location, job_id=job_id, lambda_client=lambda_client) for location in location_data]
                
        final_amount = len(thumbnails)
        
        if final_amount == requested_amount:
            logger.info(f'Generated {final_amount} thumbnails')
        elif final_amount < requested_amount:
            logger.warn(f'Generated only {final_amount} of requested {requested_amount} thumbnails')
        return thumbnails

    async def _generate_thumbnail(
            self,
            location: LocationThumbnailParam,
            job_id: str,
            lambda_client: LambdaClient,
            retry: int = 0,
    ) -> GeneratedLocationThumbnail | None:
        try:
            response = await invoke_function(
                lambda_client=lambda_client,
                function_name=SETTINGS.GENERATE_LOCATION_THUMBNAIL_LAMBDA_NAME,
                function_params={'lat': location.latitude, 'lng': location.longitude, 'prefix': job_id}
            )
            thumbnail_data = json.loads(response)
            return GeneratedLocationThumbnail(size=thumbnail_data['size'], path=thumbnail_data['path'],
                                              md5=thumbnail_data['md5'])
        except LambdaException as e:
            if retry == MAX_RETRIES:
                logger.warn('Failed to generate location thumbnail', job_id=job_id, location=location, error=e)
                return None
            else:
                retry += 1
                sleep(3 ** retry)
                return await self._generate_thumbnail(location=location, job_id=job_id, retry=retry, lambda_client=lambda_client)
        except Exception as e:
            logger.exception(e)
            return None
