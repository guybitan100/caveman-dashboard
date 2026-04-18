
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


class AudioGenerator(BaseMediaGenerator):
    
    # Default voice settings
    DEFAULT_VOICE_ID = "matthew"
    DEFAULT_LANGUAGE = "en-US"
    
    async def generate(
        self,
        story_id: str,
        prompt: str,
        voice_id: str = DEFAULT_VOICE_ID,
        language_code: str = DEFAULT_LANGUAGE,
        speaking_style: Optional[str] = None,
        **kwargs,
    ) -> GenerationResult:
        self.logger.info(f"Generating audio for story {story_id}: {prompt[:50]}...")
        
        try:
            # Get services
            bedrock_client = get_bedrock_client()
            s3_uploader = get_s3_uploader()
            
            # Generate the audio
            result = await bedrock_client.generate_audio(
                text=prompt,
                voice_id=voice_id,
                language_code=language_code,
                speaking_style=speaking_style,
            )
            
            # Upload to S3
            upload_result = await s3_uploader.upload_audio(
                audio_bytes=result.audio_bytes,
                job_id=self.job_id,
                story_id=story_id,
                format=result.format,
            )
            
            # Build filename
            file_name = f"generated_audio_{story_id[:8]}.{result.format}"
            
            self.logger.info(f"Audio generated successfully: {upload_result.s3_key}")
            
            return GenerationResult.from_upload(
                story_id=story_id,
                upload_result=upload_result,
                file_name=file_name,
            )
            
        except Exception as e:
            error_msg = f"Audio generation failed for story {story_id}: {str(e)}"
            self.logger.error(error_msg)
            raise MediaGenerationError(error_msg, story_id=story_id)
    
    def _build_prompt(self, story_context: dict) -> str:
        # For audio, we might want to extract dialogue or description
        text = story_context.get("text", "")
        if not text:
            text = story_context.get("user_description", "")
        
        return text
    
    def get_voice_for_entity(self, entity_id: str, entity_data: dict) -> tuple[str, str]:
        characteristics = entity_data.get("characteristics", {})
        voice = characteristics.get("voice", {})
        
        voice_id = voice.get("voice_id", self.DEFAULT_VOICE_ID)
        language_code = voice.get("language_code", self.DEFAULT_LANGUAGE)
        
        return voice_id, language_code
