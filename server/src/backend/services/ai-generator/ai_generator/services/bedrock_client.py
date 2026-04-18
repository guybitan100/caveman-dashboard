"""
Async AWS Bedrock Client for media generation.

This module provides an async wrapper around AWS Bedrock runtime for generating
images, videos, and audio using Amazon Nova models.
"""
import asyncio
import base64
import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import aioboto3
from botocore.config import Config

from ai_generator.settings import SETTINGS

logger = logging.getLogger(__name__)


class MediaGenerationStatus(str, Enum):
    """Status of async media generation job."""
    
    IN_PROGRESS = "InProgress"
    COMPLETED = "Completed"
    FAILED = "Failed"


@dataclass
class ImageGenerationResult:
    """Result of image generation."""
    
    image_bytes: bytes
    format: str = "png"
    width: int = 1024
    height: int = 1024


@dataclass
class VideoGenerationResult:
    """Result of video generation."""
    
    s3_uri: str
    duration_seconds: float = 6.0
    format: str = "mp4"


@dataclass
class AudioGenerationResult:
    """Result of audio/speech generation."""
    
    audio_bytes: bytes
    format: str = "mp3"
    duration_seconds: Optional[float] = None


@dataclass
class AsyncJobStatus:
    """Status of an async generation job (e.g., Nova Reel)."""
    
    job_arn: str
    status: MediaGenerationStatus
    output_uri: Optional[str] = None
    error_message: Optional[str] = None


class BedrockClient:
    """
    Async client for AWS Bedrock media generation.
    
    Supports:
    - Image generation via Nova Canvas (sync)
    - Video generation via Nova Reel (async with polling)
    - Audio generation via Nova Sonic (sync)
    """
    
    def __init__(
        self,
        region: Optional[str] = None,
    ):
        """
        Initialize Bedrock client.
        
        Args:
            region: AWS region. Defaults to settings.BEDROCK_REGION
        """
        self.region = region or SETTINGS.BEDROCK_REGION
        self._session = aioboto3.Session()
        self._config = Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=30,
            read_timeout=120,
        )
    
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        seed: Optional[int] = None,
        quality: str = "standard",
    ) -> ImageGenerationResult:
        """
        Generate an image using Nova Canvas.
        
        Args:
            prompt: Text description of the image to generate
            negative_prompt: What to avoid in the image
            width: Image width (512-2048, must be divisible by 64)
            height: Image height (512-2048, must be divisible by 64)
            seed: Random seed for reproducibility
            quality: "standard" or "premium"
            
        Returns:
            ImageGenerationResult with image bytes
            
        Raises:
            Exception: On generation failure
        """
        # Build request body for Nova Canvas
        request_body: dict[str, Any] = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt,
            },
            "imageGenerationConfig": {
                "width": width,
                "height": height,
                "quality": quality,
                "numberOfImages": 1,
            },
        }
        
        if negative_prompt:
            request_body["textToImageParams"]["negativeText"] = negative_prompt
        
        if seed is not None:
            request_body["imageGenerationConfig"]["seed"] = seed
        
        logger.info(f"Generating image with Nova Canvas: {prompt[:50]}...")
        
        async with self._session.client(
            "bedrock-runtime",
            region_name=self.region,
            config=self._config,
        ) as client:
            response = await client.invoke_model(
                modelId=SETTINGS.BEDROCK_IMAGE_MODEL,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body),
            )
            
            response_body = json.loads(await response["body"].read())
            
            # Nova Canvas returns base64-encoded image in "images" array
            if "images" not in response_body or not response_body["images"]:
                raise Exception(f"No image returned from Nova Canvas: {response_body}")
            
            image_b64 = response_body["images"][0]
            image_bytes = base64.b64decode(image_b64)
            
            logger.info(f"Image generated successfully: {len(image_bytes)} bytes")
            
            return ImageGenerationResult(
                image_bytes=image_bytes,
                format="png",
                width=width,
                height=height,
            )
    
    async def start_video_generation(
        self,
        prompt: str,
        s3_output_uri: str,
        duration_seconds: float = 6.0,
        fps: int = 24,
        dimension: str = "1280x720",
        seed: Optional[int] = None,
    ) -> str:
        """
        Start async video generation using Nova Reel.
        
        Nova Reel is an async API - it starts the job and returns a job ARN.
        Use poll_video_generation() to check status and get results.
        
        Args:
            prompt: Text description of the video to generate
            s3_output_uri: S3 URI where video will be written (s3://bucket/prefix/)
            duration_seconds: Video duration (max 6 seconds)
            fps: Frames per second (24)
            dimension: Video dimensions ("1280x720")
            seed: Random seed for reproducibility
            
        Returns:
            Job ARN for polling status
            
        Raises:
            Exception: On job start failure
        """
        # Build request body for Nova Reel
        request_body: dict[str, Any] = {
            "taskType": "TEXT_VIDEO",
            "textToVideoParams": {
                "text": prompt,
            },
            "videoGenerationConfig": {
                "durationSeconds": int(duration_seconds),
                "fps": fps,
                "dimension": dimension,
            },
        }
        
        if seed is not None:
            request_body["videoGenerationConfig"]["seed"] = seed
        
        logger.info(f"Starting video generation with Nova Reel: {prompt[:50]}...")
        
        async with self._session.client(
            "bedrock-runtime",
            region_name=self.region,
            config=self._config,
        ) as client:
            response = await client.start_async_invoke(
                modelId=SETTINGS.BEDROCK_VIDEO_MODEL,
                modelInput=request_body,
                outputDataConfig={
                    "s3OutputDataConfig": {
                        "s3Uri": s3_output_uri,
                    }
                },
            )
            
            job_arn = response["invocationArn"]
            logger.info(f"Video generation started: {job_arn}")
            
            return job_arn
    
    async def poll_video_generation(
        self,
        job_arn: str,
    ) -> AsyncJobStatus:
        """
        Check status of async video generation job.
        
        Args:
            job_arn: Job ARN from start_video_generation()
            
        Returns:
            AsyncJobStatus with current status and output URI if completed
        """
        async with self._session.client(
            "bedrock-runtime",
            region_name=self.region,
            config=self._config,
        ) as client:
            response = await client.get_async_invoke(
                invocationArn=job_arn,
            )
            
            status_str = response.get("status", "InProgress")
            status = MediaGenerationStatus(status_str)
            
            output_uri = None
            error_message = None
            
            if status == MediaGenerationStatus.COMPLETED:
                output_config = response.get("outputDataConfig", {})
                s3_config = output_config.get("s3OutputDataConfig", {})
                output_uri = s3_config.get("s3Uri")
                logger.info(f"Video generation completed: {output_uri}")
            elif status == MediaGenerationStatus.FAILED:
                error_message = response.get("failureMessage", "Unknown error")
                logger.error(f"Video generation failed: {error_message}")
            
            return AsyncJobStatus(
                job_arn=job_arn,
                status=status,
                output_uri=output_uri,
                error_message=error_message,
            )
    
    async def wait_for_video_generation(
        self,
        job_arn: str,
        poll_interval: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> AsyncJobStatus:
        """
        Wait for video generation to complete with polling.
        
        Args:
            job_arn: Job ARN from start_video_generation()
            poll_interval: Seconds between polls. Defaults to settings
            timeout: Max seconds to wait. Defaults to settings
            
        Returns:
            Final AsyncJobStatus
            
        Raises:
            TimeoutError: If generation doesn't complete within timeout
        """
        poll_interval = poll_interval or SETTINGS.VIDEO_GENERATION_POLL_INTERVAL
        timeout = timeout or SETTINGS.VIDEO_GENERATION_TIMEOUT
        
        elapsed = 0
        while elapsed < timeout:
            status = await self.poll_video_generation(job_arn)
            
            if status.status != MediaGenerationStatus.IN_PROGRESS:
                return status
            
            logger.debug(f"Video generation in progress, waiting {poll_interval}s...")
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        
        raise TimeoutError(
            f"Video generation timed out after {timeout}s: {job_arn}"
        )
    
    async def generate_audio(
        self,
        text: str,
        voice_id: str = "matthew",
        language_code: str = "en-US",
        speaking_style: Optional[str] = None,
    ) -> AudioGenerationResult:
        """
        Generate speech audio using Nova Sonic.
        
        Args:
            text: Text to convert to speech
            voice_id: Voice identifier
            language_code: Language code (e.g., "en-US")
            speaking_style: Optional speaking style modifier
            
        Returns:
            AudioGenerationResult with audio bytes
            
        Raises:
            Exception: On generation failure
        """
        # Build request body for Nova Sonic
        # Note: Nova Sonic API structure may need adjustment based on actual API
        request_body: dict[str, Any] = {
            "text": text,
            "voiceId": voice_id,
            "languageCode": language_code,
        }
        
        if speaking_style:
            request_body["speakingStyle"] = speaking_style
        
        logger.info(f"Generating audio with Nova Sonic: {text[:50]}...")
        
        async with self._session.client(
            "bedrock-runtime",
            region_name=self.region,
            config=self._config,
        ) as client:
            response = await client.invoke_model(
                modelId=SETTINGS.BEDROCK_AUDIO_MODEL,
                contentType="application/json",
                accept="audio/mpeg",
                body=json.dumps(request_body),
            )
            
            # Nova Sonic returns audio bytes directly
            audio_bytes = await response["body"].read()
            
            logger.info(f"Audio generated successfully: {len(audio_bytes)} bytes")
            
            return AudioGenerationResult(
                audio_bytes=audio_bytes,
                format="mp3",
            )


# Singleton instance
_bedrock_client: Optional[BedrockClient] = None


def get_bedrock_client() -> BedrockClient:
    """Get or create the Bedrock client singleton."""
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = BedrockClient()
    return _bedrock_client
