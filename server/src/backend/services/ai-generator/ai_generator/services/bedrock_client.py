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
    
    IN_PROGRESS = "InProgress"
    COMPLETED = "Completed"
    FAILED = "Failed"


@dataclass
class ImageGenerationResult:
    
    image_bytes: bytes
    format: str = "png"
    width: int = 1024
    height: int = 1024


@dataclass
class VideoGenerationResult:
    
    s3_uri: str
    duration_seconds: float = 6.0
    format: str = "mp4"


@dataclass
class AudioGenerationResult:
    
    audio_bytes: bytes
    format: str = "mp3"
    duration_seconds: Optional[float] = None


@dataclass
class AsyncJobStatus:
    
    job_arn: str
    status: MediaGenerationStatus
    output_uri: Optional[str] = None
    error_message: Optional[str] = None


class BedrockClient:
    
    def __init__(
        self,
        region: Optional[str] = None,
    ):
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
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = BedrockClient()
    return _bedrock_client
