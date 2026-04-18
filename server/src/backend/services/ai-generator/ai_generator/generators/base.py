
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from ai_generator.services.s3_uploader import UploadResult
from model.stories import StoryFileInfo

logger = logging.getLogger(__name__)


class MediaGenerationError(Exception):
    
    def __init__(self, message: str, story_id: Optional[str] = None, retryable: bool = True):
        super().__init__(message)
        self.story_id = story_id
        self.retryable = retryable


@dataclass
class GenerationResult:
    
    story_id: str
    file_info: StoryFileInfo
    success: bool = True
    error_message: Optional[str] = None
    
    @classmethod
    def from_upload(
        cls,
        story_id: str,
        upload_result: UploadResult,
        file_name: str,
    ) -> "GenerationResult":
        return cls(
            story_id=story_id,
            file_info=StoryFileInfo(
                s3_key=upload_result.s3_key,
                file_type="upload",  # Generated files are treated as uploads
                file_name=file_name,
                size=upload_result.size_bytes,
            ),
        )
    
    @classmethod
    def failure(cls, story_id: str, error: str) -> "GenerationResult":
        return cls(
            story_id=story_id,
            file_info=StoryFileInfo(
                s3_key="",
                file_type="upload",
                file_name="",
                size=1,  # Must be > 0 for validation, even for failures
            ),
            success=False,
            error_message=error,
        )


class BaseMediaGenerator(ABC):
    
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    async def generate(
        self,
        story_id: str,
        prompt: str,
        **kwargs,
    ) -> GenerationResult:
        pass
    
    def _build_prompt(self, story_context: dict) -> str:
        description = story_context.get("user_description", "")
        return description
