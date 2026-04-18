"""Base class and common types for media generators."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from ai_generator.services.s3_uploader import UploadResult
from model.stories import StoryFileInfo

logger = logging.getLogger(__name__)


class MediaGenerationError(Exception):
    """Error during media generation."""
    
    def __init__(self, message: str, story_id: Optional[str] = None, retryable: bool = True):
        super().__init__(message)
        self.story_id = story_id
        self.retryable = retryable


@dataclass
class GenerationResult:
    """Result of a media generation operation."""
    
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
        """Create a GenerationResult from an S3 upload result."""
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
        """Create a failed GenerationResult."""
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
    """Abstract base class for media generators."""
    
    def __init__(self, job_id: str):
        """
        Initialize the generator.
        
        Args:
            job_id: The generation job ID for organizing S3 output
        """
        self.job_id = job_id
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    async def generate(
        self,
        story_id: str,
        prompt: str,
        **kwargs,
    ) -> GenerationResult:
        """
        Generate media for a story.
        
        Args:
            story_id: Unique identifier for the story
            prompt: Text prompt describing the media to generate
            **kwargs: Additional generation parameters
            
        Returns:
            GenerationResult with file info and S3 location
            
        Raises:
            MediaGenerationError: On generation failure
        """
        pass
    
    def _build_prompt(self, story_context: dict) -> str:
        """
        Build a generation prompt from story context.
        
        Override in subclasses for media-specific prompt formatting.
        
        Args:
            story_context: Dictionary containing story metadata and description
            
        Returns:
            Formatted prompt string
        """
        description = story_context.get("user_description", "")
        return description
