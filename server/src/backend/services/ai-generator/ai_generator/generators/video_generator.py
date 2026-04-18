
import logging
from typing import Optional

from ai_generator.generators.base import (
    BaseMediaGenerator,
    GenerationResult,
    MediaGenerationError,
)
from ai_generator.services.bedrock_client import (
    get_bedrock_client,
    MediaGenerationStatus,
)
from ai_generator.services.s3_uploader import get_s3_uploader

logger = logging.getLogger(__name__)


class VideoGenerator(BaseMediaGenerator):
    
    # Default video settings
    DEFAULT_DURATION = 6  # seconds (Nova Reel max)
    DEFAULT_FPS = 24
    DEFAULT_DIMENSION = "1280x720"
    
    async def generate(
        self,
        story_id: str,
        prompt: str,
        duration_seconds: float = DEFAULT_DURATION,
        fps: int = DEFAULT_FPS,
        dimension: str = DEFAULT_DIMENSION,
        seed: Optional[int] = None,
        **kwargs,
    ) -> GenerationResult:
        self.logger.info(f"Generating video for story {story_id}: {prompt[:50]}...")
        
        bedrock_client = get_bedrock_client()
        s3_uploader = get_s3_uploader()
        
        # Get temp location for Nova Reel output
        output_location = s3_uploader.get_video_output_location(
            job_id=self.job_id,
            story_id=story_id,
        )
        
        try:
            # Start async video generation
            job_arn = await bedrock_client.start_video_generation(
                prompt=prompt,
                s3_output_uri=output_location.s3_uri,
                duration_seconds=duration_seconds,
                fps=fps,
                dimension=dimension,
                seed=seed,
            )
            
            self.logger.info(f"Video generation started: {job_arn}")
            
            # Wait for completion with polling
            status = await bedrock_client.wait_for_video_generation(job_arn)
            
            if status.status == MediaGenerationStatus.FAILED:
                raise MediaGenerationError(
                    f"Video generation failed: {status.error_message}",
                    story_id=story_id,
                    retryable=True,
                )
            
            if status.status != MediaGenerationStatus.COMPLETED:
                raise MediaGenerationError(
                    f"Unexpected video generation status: {status.status}",
                    story_id=story_id,
                    retryable=False,
                )
            
            # Copy from temp location to final uploads location
            upload_result = await s3_uploader.copy_video_from_nova_reel(
                source_uri=output_location.s3_uri,
                job_id=self.job_id,
                story_id=story_id,
            )
            
            # Clean up temp Nova Reel output
            await s3_uploader.delete_nova_reel_output(output_location.s3_uri)
            
            # Build filename
            file_name = f"generated_video_{story_id[:8]}.mp4"
            
            self.logger.info(f"Video generated successfully: {upload_result.s3_key}")
            
            return GenerationResult.from_upload(
                story_id=story_id,
                upload_result=upload_result,
                file_name=file_name,
            )
            
        except MediaGenerationError:
            # Re-raise media generation errors
            raise
        except TimeoutError as e:
            error_msg = f"Video generation timed out for story {story_id}: {str(e)}"
            self.logger.error(error_msg)
            raise MediaGenerationError(error_msg, story_id=story_id, retryable=True)
        except Exception as e:
            error_msg = f"Video generation failed for story {story_id}: {str(e)}"
            self.logger.error(error_msg)
            raise MediaGenerationError(error_msg, story_id=story_id)
        finally:
            # Best effort cleanup of temp files even on error
            try:
                await s3_uploader.delete_nova_reel_output(output_location.s3_uri)
            except Exception:
                pass  # Ignore cleanup errors
    
    def _build_prompt(self, story_context: dict) -> str:
        description = story_context.get("user_description", "")
        
        # Add context for dynamic scenes
        action = story_context.get("action", "")
        location = story_context.get("location", "")
        
        parts = [description]
        
        if action:
            parts.append(f"Action: {action}")
        if location:
            parts.append(f"Setting: {location}")
        
        # Add style guidance
        parts.append("Cinematic quality, smooth camera movement")
        
        return ". ".join(filter(None, parts))
