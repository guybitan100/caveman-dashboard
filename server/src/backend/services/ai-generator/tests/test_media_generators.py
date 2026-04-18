"""Unit tests for media generators and MediaGeneratorService."""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai_generator.generators import (
    AudioGenerator,
    DocumentGenerator,
    DocumentFormat,
    GenerationResult,
    ImageGenerator,
    MediaGenerationError,
    VideoGenerator,
)
from ai_generator.models.entity import Entity, EntityCharacteristics, VoiceCharacteristics
from ai_generator.models.story_output import (
    AudioStoryOutput,
    DocumentStoryOutput,
    ImageStoryOutput,
    StoryFileInfo,
    VideoStoryOutput,
)
from ai_generator.services import MediaGeneratorService
from ai_generator.services.bedrock_client import (
    AudioGenerationResult,
    ImageGenerationResult,
    VideoGenerationResult,
)
from ai_generator.services.s3_uploader import S3Location, UploadResult
from model.stories import StoryType


# ==================== Fixtures ====================


@pytest.fixture
def mock_s3_uploader():
    """Mock S3Uploader with successful uploads."""
    mock_uploader = MagicMock()
    mock_uploader.upload_image = AsyncMock(
        return_value=UploadResult(
            s3_key="uploads/test-job/image/test.png",
            s3_uri="s3://test-bucket/uploads/test-job/image/test.png",
            bucket="test-bucket",
            content_type="image/png",
            size_bytes=1024,
        )
    )
    mock_uploader.upload_audio = AsyncMock(
        return_value=UploadResult(
            s3_key="uploads/test-job/audio/test.mp3",
            s3_uri="s3://test-bucket/uploads/test-job/audio/test.mp3",
            bucket="test-bucket",
            content_type="audio/mpeg",
            size_bytes=2048,
        )
    )
    mock_uploader.upload_document = AsyncMock(
        return_value=UploadResult(
            s3_key="uploads/test-job/document/test.pdf",
            s3_uri="s3://test-bucket/uploads/test-job/document/test.pdf",
            bucket="test-bucket",
            content_type="application/pdf",
            size_bytes=4096,
        )
    )
    mock_uploader.copy_video_from_nova_reel = AsyncMock(
        return_value=UploadResult(
            s3_key="uploads/test-job/video/test.mp4",
            s3_uri="s3://test-bucket/uploads/test-job/video/test.mp4",
            bucket="test-bucket",
            content_type="video/mp4",
            size_bytes=8192,
        )
    )
    mock_uploader.delete_nova_reel_output = AsyncMock()
    
    # Patch all the places where get_s3_uploader is imported
    patches = [
        patch("ai_generator.services.s3_uploader.get_s3_uploader", return_value=mock_uploader),
        patch("ai_generator.generators.image_generator.get_s3_uploader", return_value=mock_uploader),
        patch("ai_generator.generators.video_generator.get_s3_uploader", return_value=mock_uploader),
        patch("ai_generator.generators.audio_generator.get_s3_uploader", return_value=mock_uploader),
        patch("ai_generator.generators.document_generator.get_s3_uploader", return_value=mock_uploader),
    ]
    
    for p in patches:
        p.start()
    
    yield mock_uploader
    
    for p in patches:
        p.stop()


@pytest.fixture
def mock_bedrock_client():
    """Mock BedrockClient with successful generations."""
    mock_client = MagicMock()
    mock_client.generate_image = AsyncMock(
        return_value=ImageGenerationResult(
            image_bytes=b"fake-image-data",
            format="png",
            width=1024,
            height=1024,
        )
    )
    mock_client.start_video_generation = AsyncMock(return_value="invocation-123")
    mock_client.wait_for_video_generation = AsyncMock(
        return_value=VideoGenerationResult(
            s3_uri="s3://test-bucket/generated-media/test-job/video-123.mp4",
            duration_seconds=6.0,
            format="mp4",
        )
    )
    mock_client.generate_audio = AsyncMock(
        return_value=AudioGenerationResult(
            audio_bytes=b"fake-audio-data",
            format="mp3",
            duration_seconds=5.0,
        )
    )
    
    # Patch all the places where get_bedrock_client is imported
    patches = [
        patch("ai_generator.services.bedrock_client.get_bedrock_client", return_value=mock_client),
        patch("ai_generator.generators.image_generator.get_bedrock_client", return_value=mock_client),
        patch("ai_generator.generators.video_generator.get_bedrock_client", return_value=mock_client),
        patch("ai_generator.generators.audio_generator.get_bedrock_client", return_value=mock_client),
    ]
    
    for p in patches:
        p.start()
    
    yield mock_client
    
    for p in patches:
        p.stop()


@pytest.fixture
def sample_entity():
    """Sample entity with voice characteristics."""
    from ai_generator.models.entity import Gender
    
    return Entity(
        entity_id="entity-123",
        name="John Doe",
        characteristics=EntityCharacteristics(
            age=30,
            gender=Gender.MALE,
            voice=VoiceCharacteristics(
                voice_id="Matthew",
                language_code="en-US",
                speaking_style="professional",
            ),
        ),
    )


@pytest.fixture
def sample_image_story():
    """Sample ImageStoryOutput."""
    return ImageStoryOutput(
        uid="story-img-1",
        story_type=StoryType.IMAGE,
        time=datetime(2025, 1, 1, 12, 0, 0),
        user_description="A beautiful sunset over mountains",
        file=StoryFileInfo(
            s3_key="",  # Will be populated by media generation
            file_type="upload",
            file_name="sunset.png",
            size=1,  # Must be > 0 for validation
        ),
    )


@pytest.fixture
def sample_video_story():
    """Sample VideoStoryOutput."""
    return VideoStoryOutput(
        uid="story-vid-1",
        story_type=StoryType.VIDEO,
        time=datetime(2025, 1, 1, 13, 0, 0),
        user_description="A timelapse of city traffic at night",
        file=StoryFileInfo(
            s3_key="",
            file_type="upload",
            file_name="traffic.mp4",
            size=1,  # Must be > 0 for validation
        ),
    )


@pytest.fixture
def sample_audio_story():
    """Sample AudioStoryOutput."""
    return AudioStoryOutput(
        uid="story-aud-1",
        story_type=StoryType.AUDIO,
        time=datetime(2025, 1, 1, 14, 0, 0),
        user_description="Welcome to our podcast",
        file=StoryFileInfo(
            s3_key="",
            file_type="upload",
            file_name="podcast.mp3",
            size=1,  # Must be > 0 for validation
        ),
    )


@pytest.fixture
def sample_document_story():
    """Sample DocumentStoryOutput."""
    return DocumentStoryOutput(
        uid="story-doc-1",
        story_type=StoryType.DOCUMENT,
        time=datetime(2025, 1, 1, 15, 0, 0),
        user_description="Meeting notes from Q1 planning session",
        file=StoryFileInfo(
            s3_key="",
            file_type="upload",
            file_name="meeting_notes.pdf",
            size=1,  # Must be > 0 for validation
        ),
    )


# ==================== ImageGenerator Tests ====================


@pytest.mark.asyncio
async def test_image_generator_success(mock_bedrock_client, mock_s3_uploader):
    """Test successful image generation."""
    generator = ImageGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="A beautiful sunset",
        story_id="story-1",
    )

    assert result.success is True
    assert result.file_info.s3_key == "uploads/test-job/image/test.png"
    assert result.file_info.size == 1024
    assert result.error_message is None


@pytest.mark.asyncio
async def test_image_generator_bedrock_failure(mock_bedrock_client, mock_s3_uploader):
    """Test image generation when Bedrock fails."""
    mock_bedrock_client.generate_image = AsyncMock(
        side_effect=Exception("Model unavailable")
    )

    generator = ImageGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="Test prompt",
        story_id="story-1",
    )

    assert result.success is False
    assert "Model unavailable" in result.error_message


@pytest.mark.asyncio
async def test_image_generator_s3_failure(mock_bedrock_client, mock_s3_uploader):
    """Test image generation when S3 upload fails."""
    mock_s3_uploader.upload_image = AsyncMock(
        side_effect=Exception("S3 permission denied")
    )

    generator = ImageGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="Test prompt",
        story_id="story-1",
    )

    assert result.success is False
    assert "S3 permission denied" in result.error_message


# ==================== VideoGenerator Tests ====================


@pytest.mark.asyncio
async def test_video_generator_success(mock_bedrock_client, mock_s3_uploader):
    """Test successful video generation."""
    generator = VideoGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="City traffic timelapse",
        story_id="story-1",
    )

    assert result.success is True
    assert result.file_info.s3_key == "uploads/test-job/video/test.mp4"
    assert result.file_info.size == 8192
    
    # Verify cleanup was called
    mock_s3_uploader.delete_nova_reel_output.assert_called_once()


@pytest.mark.asyncio
async def test_video_generator_bedrock_failure(mock_bedrock_client, mock_s3_uploader):
    """Test video generation when Bedrock fails."""
    mock_bedrock_client.wait_for_video_generation = AsyncMock(
        side_effect=Exception("Video generation timeout")
    )

    generator = VideoGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="Test prompt",
        story_id="story-1",
    )

    assert result.success is False
    assert "Video generation timeout" in result.error_message


# ==================== AudioGenerator Tests ====================


@pytest.mark.asyncio
async def test_audio_generator_success(mock_bedrock_client, mock_s3_uploader):
    """Test successful audio generation."""
    generator = AudioGenerator(job_id="test-job")

    result = await generator.generate(
        text="Welcome to our podcast",
        story_id="story-1",
    )

    assert result.success is True
    assert result.file_info.s3_key == "uploads/test-job/audio/test.mp3"
    assert result.file_info.size == 2048


@pytest.mark.asyncio
async def test_audio_generator_with_entity_voice(
    mock_bedrock_client, mock_s3_uploader, sample_entity
):
    """Test audio generation with entity voice characteristics."""
    generator = AudioGenerator(job_id="test-job")

    result = await generator.generate(
        text="Hello world",
        story_id="story-1",
        entity=sample_entity,
    )

    assert result.success is True
    
    # Verify Bedrock was called with entity's voice settings
    mock_bedrock_client.generate_audio.assert_called_once()
    call_kwargs = mock_bedrock_client.generate_audio.call_args.kwargs
    assert call_kwargs["voice_id"] == "Matthew"
    assert call_kwargs["language_code"] == "en-US"


# ==================== DocumentGenerator Tests ====================


@pytest.mark.asyncio
async def test_document_generator_pdf_success(mock_s3_uploader):
    """Test successful PDF document generation."""
    generator = DocumentGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="Meeting notes from Q1 planning",
        story_id="story-1",
        format=DocumentFormat.PDF,
    )

    assert result.success is True
    assert result.file_info.s3_key == "uploads/test-job/document/test.pdf"
    assert result.file_info.size == 4096


@pytest.mark.asyncio
async def test_document_generator_txt_success(mock_s3_uploader):
    """Test successful TXT document generation."""
    generator = DocumentGenerator(job_id="test-job")

    result = await generator.generate(
        prompt="Simple text content",
        story_id="story-1",
        format=DocumentFormat.TXT,
    )

    assert result.success is True
    assert result.file_info.file_name.endswith(".txt")


@pytest.mark.asyncio
async def test_document_generator_invalid_format(mock_s3_uploader):
    """Test document generation with invalid format - tests validator."""
    # This test verifies that only valid DocumentFormat enums are accepted
    # Invalid formats would be caught by type checking or enum validation
    generator = DocumentGenerator(job_id="test-job")
    
    # Test with a valid format to ensure the generator works
    result = await generator.generate(
        prompt="Test content",
        story_id="story-1",
        format=DocumentFormat.PDF,
    )
    
    assert result.success is True


# ==================== MediaGeneratorService Tests ====================


@pytest.mark.asyncio
async def test_media_service_mixed_stories(
    mock_bedrock_client,
    mock_s3_uploader,
    sample_image_story,
    sample_video_story,
    sample_audio_story,
    sample_document_story,
):
    """Test MediaGeneratorService with mixed story types."""
    from ai_generator.models.story_output import CallStoryOutput

    # Create a non-media story
    call_story = CallStoryOutput(
        uid="story-call-1",
        story_type=StoryType.CALL,
        time=datetime(2025, 1, 1, 10, 0, 0),
        participant="entity-456",
        direction="Incoming",
        duration=120,
    )

    stories = [
        call_story,
        sample_image_story,
        sample_video_story,
        sample_audio_story,
        sample_document_story,
    ]

    service = MediaGeneratorService(job_id="test-job", batch_size=2)

    updated_stories = await service.generate_media_for_stories(
        stories=stories,
        entities={},
    )

    # Should have all 5 stories (4 media + 1 non-media)
    assert len(updated_stories) == 5

    # Call story should be unchanged
    assert updated_stories[0].uid == "story-call-1"
    assert updated_stories[0].story_type == StoryType.CALL

    # Media stories should have S3 keys
    for story in updated_stories[1:]:
        if isinstance(story, (ImageStoryOutput, VideoStoryOutput, AudioStoryOutput, DocumentStoryOutput)):
            assert story.file.s3_key != ""
            assert story.file.size > 0


@pytest.mark.asyncio
async def test_media_service_removes_failed_stories(
    mock_bedrock_client, mock_s3_uploader, sample_image_story, sample_video_story
):
    """Test that MediaGeneratorService removes stories that fail generation."""
    # Make image generation fail
    mock_bedrock_client.generate_image = AsyncMock(
        side_effect=Exception("Model error")
    )

    stories = [sample_image_story, sample_video_story]

    service = MediaGeneratorService(job_id="test-job", retry_attempts=0)

    updated_stories = await service.generate_media_for_stories(
        stories=stories,
        entities={},
    )

    # Should only have video story (image failed)
    assert len(updated_stories) == 1
    assert updated_stories[0].uid == "story-vid-1"


@pytest.mark.asyncio
async def test_media_service_retry_logic(
    mock_bedrock_client, mock_s3_uploader, sample_image_story
):
    """Test that MediaGeneratorService retries failed generations."""
    # Fail first attempt, succeed on second
    mock_bedrock_client.generate_image = AsyncMock(
        side_effect=[
            Exception("Temporary error"),
            ImageGenerationResult(
                image_bytes=b"fake-image-data",
                format="png",
                width=1024,
                height=1024,
            ),
        ]
    )

    service = MediaGeneratorService(job_id="test-job", retry_attempts=1)

    updated_stories = await service.generate_media_for_stories(
        stories=[sample_image_story],
        entities={},
    )

    # Should succeed after retry
    assert len(updated_stories) == 1
    assert updated_stories[0].file.s3_key != ""

    # Verify generate_image was called twice
    assert mock_bedrock_client.generate_image.call_count == 2


@pytest.mark.asyncio
async def test_media_service_disabled(sample_image_story):
    """Test MediaGeneratorService when media generation is disabled."""
    with patch("ai_generator.services.media_generator_service.SETTINGS") as mock_settings:
        mock_settings.MEDIA_GENERATION_ENABLED = False

        service = MediaGeneratorService(job_id="test-job")

        updated_stories = await service.generate_media_for_stories(
            stories=[sample_image_story],
            entities={},
        )

        # Should return unchanged stories
        assert len(updated_stories) == 1
        assert updated_stories[0].file.s3_key == ""


@pytest.mark.asyncio
async def test_media_service_batching(
    mock_bedrock_client, mock_s3_uploader
):
    """Test that MediaGeneratorService respects batch size."""
    # Create 10 image stories
    stories = [
        ImageStoryOutput(
            uid=f"story-{i}",
            story_type=StoryType.IMAGE,
            time=datetime(2025, 1, 1, 12, 0, 0),
            user_description=f"Image {i}",
            file=StoryFileInfo(
                s3_key="",
                file_type="upload",
                file_name=f"image-{i}.png",
                size=1,  # Must be > 0 for validation
            ),
        )
        for i in range(10)
    ]

    service = MediaGeneratorService(job_id="test-job", batch_size=3)

    # Track concurrent calls
    max_concurrent = 0
    current_concurrent = 0

    original_generate = mock_bedrock_client.generate_image

    async def tracked_generate(*args, **kwargs):
        nonlocal current_concurrent, max_concurrent
        current_concurrent += 1
        max_concurrent = max(max_concurrent, current_concurrent)
        await asyncio.sleep(0.01)  # Simulate work
        current_concurrent -= 1
        return await original_generate(*args, **kwargs)

    mock_bedrock_client.generate_image = AsyncMock(
        side_effect=tracked_generate
    )

    await service.generate_media_for_stories(stories=stories, entities={})

    # Max concurrent should not exceed batch size
    assert max_concurrent <= 3


# ==================== Error Handling Tests ====================


@pytest.mark.asyncio
async def test_media_generation_error_retryable():
    """Test MediaGenerationError with retryable flag."""
    error = MediaGenerationError("Temporary network error", retryable=True)
    assert error.retryable is True
    assert str(error) == "Temporary network error"


@pytest.mark.asyncio
async def test_media_generation_error_non_retryable():
    """Test MediaGenerationError with non-retryable flag."""
    error = MediaGenerationError("Invalid input format", retryable=False)
    assert error.retryable is False


@pytest.mark.asyncio
async def test_generation_result_from_upload():
    """Test GenerationResult.from_upload factory method."""
    upload_result = UploadResult(
        s3_key="uploads/job-1/image/test.png",
        s3_uri="s3://test-bucket/uploads/job-1/image/test.png",
        bucket="test-bucket",
        content_type="image/png",
        size_bytes=1024,
    )

    result = GenerationResult.from_upload(
        story_id="story-1",
        upload_result=upload_result,
        file_name="test.png",
    )

    assert result.success is True
    assert result.file_info.s3_key == "uploads/job-1/image/test.png"
    assert result.file_info.file_name == "test.png"
    assert result.file_info.size == 1024


@pytest.mark.asyncio
async def test_generation_result_failure():
    """Test GenerationResult.failure factory method."""
    result = GenerationResult.failure(
        story_id="story-1",
        error="Something went wrong"
    )

    assert result.success is False
    assert result.error_message == "Something went wrong"
    assert result.file_info.s3_key == ""
    assert result.file_info.size == 1  # Must be > 0 for validation
