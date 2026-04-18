"""Orchestrates media generation for all story types using specialized generators."""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Sequence

from ai_generator.generators import (
    AudioGenerator,
    DocumentGenerator,
    GenerationResult,
    ImageGenerator,
    VideoGenerator,
)
from ai_generator.models.entity import Entity
from ai_generator.settings import SETTINGS
from model.stories import (
    StoryData,
    AudioStoryData,
    DocumentStoryData,
    ImageStoryData,
    VideoStoryData,
)

logger = logging.getLogger(__name__)


class MediaGeneratorService:
    """
    Orchestrates media generation for file-based stories (Image, Video, Audio, Document).
    
    Responsibilities:
    - Determines which stories need media generation
    - Routes to appropriate generator (Image/Video/Audio/Document)
    - Manages batching and concurrency
    - Handles retries and failures
    - Updates story file info with S3 paths
    - Removes stories that fail after retries
    """

    def __init__(
        self,
        job_id: str,
        batch_size: Optional[int] = None,
        retry_attempts: Optional[int] = None,
    ):
        """
        Initialize the media generator service.
        
        Args:
            job_id: Job identifier for organizing S3 uploads
            batch_size: Number of concurrent generations (default from settings)
            retry_attempts: Retry attempts before removing story (default from settings)
        """
        self.job_id = job_id
        self.batch_size = batch_size or SETTINGS.MEDIA_GENERATION_BATCH_SIZE
        self.retry_attempts = retry_attempts or SETTINGS.MEDIA_GENERATION_RETRY_ATTEMPTS

        # Initialize generators
        self.image_gen = ImageGenerator(job_id=job_id)
        self.video_gen = VideoGenerator(job_id=job_id)
        self.audio_gen = AudioGenerator(job_id=job_id)
        self.document_gen = DocumentGenerator(job_id=job_id)

    async def generate_media_for_stories(
        self,
        stories: List[StoryData],
        entities: Dict[str, Entity],
    ) -> List[StoryData]:
        """
        Generate media for all file-based stories in the list.
        
        Args:
            stories: List of story outputs (mixed types)
            entities: Entity lookup by ID (for voice characteristics, etc.)
            
        Returns:
            Updated list of stories with S3 paths set, failed stories removed
        """
        if not SETTINGS.MEDIA_GENERATION_ENABLED:
            logger.info("Media generation disabled - returning stories unchanged")
            return stories

        # Identify stories that need media generation
        media_stories = self._get_media_stories(stories)

        if not media_stories:
            logger.info("No media stories to generate")
            return stories

        logger.info(
            f"Generating media for {len(media_stories)} stories "
            f"(batch_size={self.batch_size}, retries={self.retry_attempts})"
        )

        # Generate media with batching and retries
        results = await self._generate_with_batching_and_retries(media_stories, entities)  # type: ignore[arg-type]

        # Update stories with results and remove failures
        return self._apply_results_to_stories(stories, results)

    def _get_media_stories(
        self, stories: List[StoryData]
    ) -> List[ImageStoryData | VideoStoryData | AudioStoryData | DocumentStoryData]:
        """Extract only file-based stories that need media generation."""
        media_stories: List[ImageStoryData | VideoStoryData | AudioStoryData | DocumentStoryData] = []
        for story in stories:
            if isinstance(story, (ImageStoryData, VideoStoryData, AudioStoryData, DocumentStoryData)):
                media_stories.append(story)  # type: ignore[arg-type]
        return media_stories

    async def _generate_with_batching_and_retries(
        self,
        stories: Sequence[ImageStoryData | VideoStoryData | AudioStoryData | DocumentStoryData],
        entities: Dict[str, Entity],
    ) -> Dict[str, GenerationResult]:
        """
        Generate media for all stories with batching and retry logic.
        
        Returns:
            Dict mapping story UID -> GenerationResult
        """
        results: Dict[str, GenerationResult] = {}
        semaphore = asyncio.Semaphore(self.batch_size)

        async def generate_with_retry(story: Any) -> tuple[str, GenerationResult]:
            """Generate media for a single story with retries."""
            story_uid = story.uid or "unknown"
            
            async with semaphore:
                for attempt in range(self.retry_attempts + 1):
                    try:
                        result = await self._generate_for_story(story, entities)
                        if result.success:
                            logger.info(f"Generated media for story {story_uid}: {result.file_info.s3_key}")
                            return story_uid, result
                        
                        # Generation failed but didn't raise exception
                        logger.warning(
                            f"Media generation failed for {story_uid} "
                            f"(attempt {attempt + 1}/{self.retry_attempts + 1}): {result.error_message}"
                        )
                        
                        if attempt < self.retry_attempts:
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                        
                    except Exception as e:
                        logger.error(
                            f"Exception generating media for {story_uid} "
                            f"(attempt {attempt + 1}/{self.retry_attempts + 1}): {e}",
                            exc_info=True,
                        )
                        
                        if attempt < self.retry_attempts:
                            await asyncio.sleep(2 ** attempt)
                        else:
                            return story_uid, GenerationResult.failure(story_uid, str(e))
                
                # All retries exhausted
                return story_uid, GenerationResult.failure(story_uid, "Max retries exceeded")

        # Generate all in parallel with batching
        tasks = [generate_with_retry(story) for story in stories]
        result_pairs = await asyncio.gather(*tasks, return_exceptions=False)

        for story_uid, result in result_pairs:
            results[story_uid] = result

        return results

    async def _generate_for_story(
        self,
        story: ImageStoryData | VideoStoryData | AudioStoryData | DocumentStoryData,
        entities: Dict[str, Entity],
    ) -> GenerationResult:
        """Route to appropriate generator based on story type."""
        prompt = story.user_description or "Generated content"
        
        if isinstance(story, ImageStoryData):
            return await self.image_gen.generate(
                prompt=prompt,
                story_id=story.uid or "unknown",
            )
        
        elif isinstance(story, VideoStoryData):
            return await self.video_gen.generate(
                prompt=prompt,
                story_id=story.uid or "unknown",
            )
        
        elif isinstance(story, AudioStoryData):
            # Try to find entity for voice characteristics
            entity = None
            # Audio stories don't have a direct entity reference, but we could enhance this
            # by adding entity_ref to BaseStoryOutput in the future
            
            return await self.audio_gen.generate(
                story_id=story.uid or "unknown",
                prompt=prompt,
            )
        elif isinstance(story, DocumentStoryData):
            # Infer format from filename if present, otherwise use PDF
            file_format = "pdf"
            if story.file.file_name:
                if story.file.file_name.endswith(".docx"):
                    file_format = "docx"
                elif story.file.file_name.endswith(".txt"):
                    file_format = "txt"
            
            return await self.document_gen.generate(
                story_id=story.uid or "unknown",
                prompt=prompt,
                format=file_format,  # type: ignore
            )
        
        else:
            return GenerationResult.failure(
                story_id=story.uid or "unknown",
                error=f"Unsupported story type: {type(story)}"
            )

    def _apply_results_to_stories(
        self,
        stories: List[StoryData],
        results: Dict[str, GenerationResult],
    ) -> List[StoryData]:
        """
        Update file stories with S3 paths and remove failed ones.
        
        Args:
            stories: Original story list
            results: Generation results by story UID
            
        Returns:
            Updated stories with successful generations, failures removed
        """
        updated_stories: List[StoryData] = []
        
        for story in stories:
            story_uid = getattr(story, "uid", None)
            
            # Non-media stories pass through unchanged
            if not isinstance(story, (ImageStoryData, VideoStoryData, AudioStoryData, DocumentStoryData)):
                updated_stories.append(story)
                continue
            
            # Check if we have a result for this story
            if story_uid not in results:
                # Shouldn't happen, but keep the story unchanged
                logger.warning(f"No result found for media story {story_uid}")
                updated_stories.append(story)
                continue
            
            result = results[story_uid]
            
            if result.success:
                # Update file info with generated media
                story.file = result.file_info
                updated_stories.append(story)
            else:
                # Remove failed story
                logger.warning(
                    f"Removing story {story_uid} due to media generation failure: {result.error_message}"
                )
                # Don't add to updated_stories
        
        success_count = len([r for r in results.values() if r.success])
        failure_count = len([r for r in results.values() if not r.success])
        
        logger.info(
            f"Media generation complete: {success_count} succeeded, "
            f"{failure_count} failed and removed"
        )
        
        return updated_stories
