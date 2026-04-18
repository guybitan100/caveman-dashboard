import logging
import mimetypes
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import aioboto3
from botocore.config import Config

from ai_generator.settings import SETTINGS

logger = logging.getLogger(__name__)

@dataclass
class UploadResult:
    
    s3_key: str
    s3_uri: str
    bucket: str
    content_type: str
    size_bytes: int

@dataclass
class S3Location:
    
    bucket: str
    prefix: str
    s3_uri: str

class S3Uploader:
    
    def __init__(
        self,
        bucket_name: Optional[str] = None,
    ):
        self.bucket = bucket_name or SETTINGS.S3_TITAN_BUCKET_NAME
        self._session = aioboto3.Session()
        self._config = Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=30,
            read_timeout=60,
        )
        
        if not self.bucket:
            logger.warning("S3_BUCKET_NAME not configured - uploads will fail")
    
    def _generate_key(
        self,
        job_id: str,
        file_type: str,
        extension: str,
        story_id: Optional[str] = None,
    ) -> str:
        file_id = story_id or str(uuid.uuid4())
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        
        return f"{job_id}/{file_type}/{timestamp}_{file_id}.{extension}"
    
    def get_video_output_location(
        self,
        job_id: str,
        story_id: Optional[str] = None,
    ) -> S3Location:
        file_id = story_id or str(uuid.uuid4())
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        
        prefix = f"{SETTINGS.S3_GENERATED_MEDIA_PREFIX}/{job_id}/video/{timestamp}_{file_id}/"
        
        return S3Location(
            bucket=self.bucket,
            prefix=prefix,
            s3_uri=f"s3://{self.bucket}/{prefix}",
        )
    
    async def upload_bytes(
        self,
        data: bytes,
        job_id: str,
        file_type: str,
        extension: str,
        story_id: Optional[str] = None,
        content_type: Optional[str] = None,
        metadata: Optional[dict[str, str]] = None,
    ) -> UploadResult:
        if not self.bucket:
            raise ValueError("S3_BUCKET_NAME not configured")
        
        # Get the key without prefix (for storing in StoryFileInfo)
        s3_key_without_prefix = self._generate_key(job_id, file_type, extension, story_id)
        
        # Add the uploads prefix for actual S3 upload
        s3_key_full = f"{SETTINGS.S3_UPLOADS_PREFIX}/{s3_key_without_prefix}"
        
        # Auto-detect content type if not provided
        if not content_type:
            content_type = mimetypes.guess_type(f"file.{extension}")[0] or "application/octet-stream"
        
        logger.info(f"Uploading to S3: {s3_key_full} ({len(data)} bytes)")
        
        upload_kwargs: dict = {
            "Bucket": self.bucket,
            "Key": s3_key_full,
            "Body": data,
            "ContentType": content_type,
        }
        
        if metadata:
            upload_kwargs["Metadata"] = metadata
        
        async with self._session.client(  # type: ignore[attr-defined]
            "s3",
            config=self._config,
        ) as client:
            await client.put_object(**upload_kwargs)
            
            logger.info(f"Upload successful: s3://{self.bucket}/{s3_key_full}")
            
            # Return the key WITHOUT prefix (API will add it during verification)
            return UploadResult(
                s3_key=s3_key_without_prefix,
                s3_uri=f"s3://{self.bucket}/{s3_key_full}",
                bucket=self.bucket,
                content_type=content_type,
                size_bytes=len(data),
            )
    
    async def upload_image(
        self,
        image_bytes: bytes,
        job_id: str,
        story_id: Optional[str] = None,
        format: str = "png",
    ) -> UploadResult:
        content_type = f"image/{format}"
        if format == "jpg":
            content_type = "image/jpeg"
        
        return await self.upload_bytes(
            data=image_bytes,
            job_id=job_id,
            file_type="image",
            extension=format,
            story_id=story_id,
            content_type=content_type,
            metadata={"generated-by": "nova-canvas"},
        )
    
    async def upload_audio(
        self,
        audio_bytes: bytes,
        job_id: str,
        story_id: Optional[str] = None,
        format: str = "mp3",
    ) -> UploadResult:
        content_type = f"audio/{format}"
        if format == "mp3":
            content_type = "audio/mpeg"
        
        return await self.upload_bytes(
            data=audio_bytes,
            job_id=job_id,
            file_type="audio",
            extension=format,
            story_id=story_id,
            content_type=content_type,
            metadata={"generated-by": "nova-sonic"},
        )
    
    async def upload_document(
        self,
        document_bytes: bytes,
        job_id: str,
        story_id: Optional[str] = None,
        format: str = "pdf",
    ) -> UploadResult:
        content_types = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt": "text/plain",
        }
        content_type = content_types.get(format, "application/octet-stream")
        
        return await self.upload_bytes(
            data=document_bytes,
            job_id=job_id,
            file_type="document",
            extension=format,
            story_id=story_id,
            content_type=content_type,
            metadata={"generated-by": "document-generator"},
        )
    
    async def copy_video_from_nova_reel(
        self,
        source_uri: str,
        job_id: str,
        story_id: Optional[str] = None,
    ) -> UploadResult:
        if not self.bucket:
            raise ValueError("S3_BUCKET_NAME not configured")
        
        # Parse source URI
        if not source_uri.startswith("s3://"):
            raise ValueError(f"Invalid S3 URI: {source_uri}")
        
        parts = source_uri[5:].split("/", 1)
        source_bucket = parts[0]
        source_key = parts[1] if len(parts) > 1 else ""
        
        # Get destination key (without prefix for storage, with prefix for S3)
        dest_key_without_prefix = self._generate_key(job_id, "video", "mp4", story_id)
        dest_key_full = f"{SETTINGS.S3_UPLOADS_PREFIX}/{dest_key_without_prefix}"
        
        logger.info(f"Copying video from {source_uri} to s3://{self.bucket}/{dest_key_full}")
        
        async with self._session.client(  # type: ignore[attr-defined]
            "s3",
            config=self._config,
        ) as client:
            # List objects in the source prefix to find the video file
            response = await client.list_objects_v2(
                Bucket=source_bucket,
                Prefix=source_key,
            )
            
            video_key = None
            video_size = 0
            for obj in response.get("Contents", []):
                if obj["Key"].endswith(".mp4"):
                    video_key = obj["Key"]
                    video_size = obj["Size"]
                    break
            
            if not video_key:
                raise Exception(f"No video file found in Nova Reel output: {source_uri}")
            
            # Copy to destination
            copy_source = {"Bucket": source_bucket, "Key": video_key}
            await client.copy_object(
                CopySource=copy_source,
                Bucket=self.bucket,
                Key=dest_key_full,
                ContentType="video/mp4",
                Metadata={"generated-by": "nova-reel"},
                MetadataDirective="REPLACE",
            )
            
            logger.info(f"Video copied successfully: s3://{self.bucket}/{dest_key_full}")
            
            # Return the key WITHOUT prefix (API will add it during verification)
            return UploadResult(
                s3_key=dest_key_without_prefix,
                s3_uri=f"s3://{self.bucket}/{dest_key_full}",
                bucket=self.bucket,
                content_type="video/mp4",
                size_bytes=video_size,
            )
    
    async def delete_nova_reel_output(
        self,
        output_uri: str,
    ) -> None:
        if not output_uri.startswith("s3://"):
            return
        
        parts = output_uri[5:].split("/", 1)
        bucket = parts[0]
        prefix = parts[1] if len(parts) > 1 else ""
        
        logger.info(f"Cleaning up Nova Reel output: {output_uri}")
        
        async with self._session.client(  # type: ignore[attr-defined]
            "s3",
            config=self._config,
        ) as client:
            # List and delete all objects in the prefix
            response = await client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
            )
            
            objects_to_delete = [
                {"Key": obj["Key"]}
                for obj in response.get("Contents", [])
            ]
            
            if objects_to_delete:
                await client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": objects_to_delete},
                )
                logger.info(f"Deleted {len(objects_to_delete)} temporary files")

# Singleton instance
_s3_uploader: Optional[S3Uploader] = None

def get_s3_uploader() -> S3Uploader:
    global _s3_uploader
    if _s3_uploader is None:
        _s3_uploader = S3Uploader()
    return _s3_uploader
