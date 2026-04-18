
import logging
from typing import Optional

from ai_generator.generators.base import (
    BaseMediaGenerator,
    GenerationResult,
    MediaGenerationError,
)
from ai_generator.services.bedrock_client import get_bedrock_client
from ai_generator.services.s3_uploader import get_s3_uploader

logger = logging.getLogger(__name__)


class ImageGenerator(BaseMediaGenerator):
    
    # Default image dimensions
    DEFAULT_WIDTH = 1024
    DEFAULT_HEIGHT = 1024
    
    async def generate(
        self,
        story_id: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        width: int = DEFAULT_WIDTH,
        height: int = DEFAULT_HEIGHT,
        seed: Optional[int] = None,
        **kwargs,
    ) -> GenerationResult:
        self.logger.info(f"Generating image for story {story_id}: {prompt[:50]}...")
        
        try:
            # Get services
            bedrock_client = get_bedrock_client()
            s3_uploader = get_s3_uploader()
            
            # Generate the image
            result = await bedrock_client.generate_image(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                seed=seed,
            )
            
            # Upload to S3
            upload_result = await s3_uploader.upload_image(
                image_bytes=result.image_bytes,
                job_id=self.job_id,
                story_id=story_id,
                format=result.format,
            )
            
            # Build filename
            file_name = f"generated_image_{story_id[:8]}.{result.format}"
            
            self.logger.info(f"Image generated successfully: {upload_result.s3_key}")
            
            return GenerationResult.from_upload(
                story_id=story_id,
                upload_result=upload_result,
                file_name=file_name,
            )
            
        except Exception as e:
            error_msg = f"Image generation failed for story {story_id}: {str(e)}"
            self.logger.error(error_msg)
            raise MediaGenerationError(error_msg, story_id=story_id)
    
    def _build_prompt(self, story_context: dict) -> str:
        description = story_context.get("user_description", "")
        
        # Add context about the scene if available
        location = story_context.get("location", "")
        time_of_day = story_context.get("time_of_day", "")
        
        parts = [description]
        
        if location:
            parts.append(f"Location: {location}")
        if time_of_day:
            parts.append(f"Time: {time_of_day}")
        
        # Add style guidance for consistency
        parts.append("High quality, realistic photograph style")
        
        return ". ".join(filter(None, parts))
