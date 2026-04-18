
import asyncio
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import aioboto3
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class GeoCoordinates(BaseModel):
    
    latitude: float = Field(description="Latitude in decimal degrees")
    longitude: float = Field(description="Longitude in decimal degrees")
    accuracy: float | None = Field(
        default=None,
        description="Accuracy/precision of the coordinates in meters"
    )


class GeocodingResult(BaseModel):
    
    original_query: str = Field(description="The original place name queried")
    
    coordinates: GeoCoordinates | None = Field(
        default=None,
        description="Resolved coordinates, None if not found"
    )
    
    formatted_address: str | None = Field(
        default=None,
        description="Formatted/normalized address from the geocoder"
    )
    
    place_type: str | None = Field(
        default=None,
        description="Type of place (e.g., 'locality', 'neighborhood', 'street')"
    )
    
    country: str | None = Field(
        default=None,
        description="Country code (ISO 3166-1 alpha-2)"
    )
    
    region: str | None = Field(
        default=None,
        description="State/province/region name"
    )
    
    city: str | None = Field(
        default=None,
        description="City/municipality name"
    )
    
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score of the geocoding result"
    )
    
    cached: bool = Field(
        default=False,
        description="Whether this result was served from cache"
    )


@dataclass
class GeocodingConfig:
    
    # AWS Location Service index name
    place_index_name: str = "titan-place-index"
    
    # AWS region
    aws_region: str = "eu-west-1"
    
    # Max results per query
    max_results: int = 1
    
    # Enable caching
    enable_cache: bool = True
    
    # Cache size (number of queries to cache)
    cache_size: int = 1000
    
    # Default bias position (center of search area)
    # Default: Tel Aviv, Israel
    bias_latitude: float = 32.0853
    bias_longitude: float = 34.7818


class GeocodingService:
    
    def __init__(self, config: GeocodingConfig | None = None) -> None:
        self.config = config or GeocodingConfig()
        self._session: aioboto3.Session | None = None
        self._cache: dict[str, GeocodingResult] = {}
    
    async def _get_client(self) -> Any:
        if self._session is None:
            self._session = aioboto3.Session()
        return self._session.client(
            "location",
            region_name=self.config.aws_region
        )
    
    def _normalize_query(self, query: str) -> str:
        return query.lower().strip()
    
    async def geocode(
        self,
        place_name: str,
        country_bias: str | None = None,
    ) -> GeocodingResult:
        normalized = self._normalize_query(place_name)
        
        # Check cache first
        if self.config.enable_cache and normalized in self._cache:
            cached_result = self._cache[normalized]
            return GeocodingResult(
                **cached_result.model_dump(),
                cached=True
            )
        
        try:
            async with await self._get_client() as client:
                # Build request parameters
                params: dict[str, Any] = {
                    "IndexName": self.config.place_index_name,
                    "Text": place_name,
                    "MaxResults": self.config.max_results,
                    "BiasPosition": [
                        self.config.bias_longitude,
                        self.config.bias_latitude,
                    ],
                }
                
                if country_bias:
                    params["FilterCountries"] = [country_bias.upper()]
                
                response = await client.search_place_index_for_text(**params)
                
                results = response.get("Results", [])
                
                if not results:
                    result = GeocodingResult(
                        original_query=place_name,
                        coordinates=None,
                        confidence=0.0,
                    )
                else:
                    place = results[0].get("Place", {})
                    geometry = place.get("Geometry", {})
                    point = geometry.get("Point", [])
                    
                    coordinates = None
                    if len(point) >= 2:
                        coordinates = GeoCoordinates(
                            longitude=point[0],
                            latitude=point[1],
                        )
                    
                    result = GeocodingResult(
                        original_query=place_name,
                        coordinates=coordinates,
                        formatted_address=place.get("Label"),
                        place_type=place.get("PlaceType"),
                        country=place.get("Country"),
                        region=place.get("Region"),
                        city=place.get("Municipality"),
                        confidence=results[0].get("Relevance", 0.0),
                    )
                
                # Cache the result
                if self.config.enable_cache:
                    if len(self._cache) >= self.config.cache_size:
                        # Simple LRU: remove first item
                        first_key = next(iter(self._cache))
                        del self._cache[first_key]
                    self._cache[normalized] = result
                
                return result
                
        except Exception as e:
            logger.error(f"Geocoding error for '{place_name}': {e}")
            return GeocodingResult(
                original_query=place_name,
                coordinates=None,
                confidence=0.0,
            )
    
    async def batch_geocode(
        self,
        place_names: list[str],
        country_bias: str | None = None,
        concurrency: int = 5,
    ) -> dict[str, GeocodingResult]:
        semaphore = asyncio.Semaphore(concurrency)
        
        async def geocode_with_semaphore(name: str) -> tuple[str, GeocodingResult]:
            async with semaphore:
                result = await self.geocode(name, country_bias)
                return name, result
        
        tasks = [geocode_with_semaphore(name) for name in place_names]
        results = await asyncio.gather(*tasks)
        
        return dict(results)
    
    def clear_cache(self) -> None:
        self._cache.clear()


# Fallback coordinates for common place types when geocoding fails
FALLBACK_COORDINATES: dict[str, GeoCoordinates] = {
    "home": GeoCoordinates(latitude=32.0853, longitude=34.7818),  # Tel Aviv default
    "office": GeoCoordinates(latitude=32.0853, longitude=34.7818),
    "work": GeoCoordinates(latitude=32.0853, longitude=34.7818),
    "school": GeoCoordinates(latitude=32.0853, longitude=34.7818),
    "unknown": GeoCoordinates(latitude=0.0, longitude=0.0),
}


def get_fallback_coordinates(place_type: str) -> GeoCoordinates | None:
    return FALLBACK_COORDINATES.get(place_type.lower())


# Singleton instance
_geocoding_service: GeocodingService | None = None


def get_geocoding_service(config: GeocodingConfig | None = None) -> GeocodingService:
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService(config)
    return _geocoding_service
