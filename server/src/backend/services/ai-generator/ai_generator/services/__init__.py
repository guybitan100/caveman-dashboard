"""Services for the AI story generation pipeline."""

from ai_generator.services.geocoding import (
    GeoCoordinates,
    GeocodingConfig,
    GeocodingResult,
    GeocodingService,
    get_fallback_coordinates,
    get_geocoding_service,
)
from ai_generator.services.ufdr_client import (
    UFDRClient,
    UFDRSubmissionResponse,
    UFDRSubmissionError,
)
from ai_generator.services.bedrock_client import (  # type: ignore
    BedrockClient,
    ImageGenerationResult,
    VideoGenerationResult,
    AudioGenerationResult,
    AsyncJobStatus,
    MediaGenerationStatus,
    get_bedrock_client,
)
from ai_generator.services.s3_uploader import (  # type: ignore
    S3Uploader,
    UploadResult,
    S3Location,
    get_s3_uploader,
)
from ai_generator.services.media_generator_service import MediaGeneratorService

__all__ = [
    # Geocoding
    "GeoCoordinates",
    "GeocodingConfig",
    "GeocodingResult",
    "GeocodingService",
    "get_fallback_coordinates",
    "get_geocoding_service",
    # UFDR
    "UFDRClient",
    "UFDRSubmissionResponse",
    "UFDRSubmissionError",
    # Bedrock Media Generation
    "BedrockClient",
    "ImageGenerationResult",
    "VideoGenerationResult",
    "AudioGenerationResult",
    "AsyncJobStatus",
    "MediaGenerationStatus",
    "get_bedrock_client",
    # S3 Uploader
    "S3Uploader",
    "UploadResult",
    "S3Location",
    "get_s3_uploader",
    # Media Generator Service
    "MediaGeneratorService",
]
