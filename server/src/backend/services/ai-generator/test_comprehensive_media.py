#!/usr/bin/env python3

import asyncio
from datetime import datetime

from ai_generator.models.story_output import (
    ImageStoryOutput,
    VideoStoryOutput,
    AudioStoryOutput,
    StoryFileInfo,
)
from ai_generator.services.media_generator_service import MediaGeneratorService
from model.stories import StoryType

async def test_all_media():
    print("\n" + "="*70)
    print("COMPREHENSIVE MEDIA GENERATION TEST")
    print("Testing: Image (Nova Canvas), Video (Nova Reel), Audio (Nova Sonic)")
    print("="*70 + "\n")
    
    # Create test stories
    stories = [
        # Test 1: Image generation
        ImageStoryOutput(
            uid="test-image-001",
            story_type=StoryType.IMAGE,
            time=datetime(2025, 1, 1, 12, 0, 0),
            user_description="A breathtaking sunset over snow-capped mountains with vibrant orange and purple sky reflecting in a crystal clear lake",
            file=StoryFileInfo(
                s3_key="",
                file_type="upload",
                file_name="test_mountain.png",
                size=1,
            ),
        ),
        
        # Test 2: Video generation  
        VideoStoryOutput(
            uid="test-video-001",
            story_type=StoryType.VIDEO,
            time=datetime(2025, 1, 1, 12, 5, 0),
            user_description="A serene walk through a misty forest at dawn, with golden sunlight filtering through tall pine trees and birds flying overhead",
            file=StoryFileInfo(
                s3_key="",
                file_type="upload",
                file_name="test_forest.mp4",
                size=1,
            ),
        ),
        
        # Test 3: Audio generation (default voice)
        AudioStoryOutput(
            uid="test-audio-001",
            story_type=StoryType.AUDIO,
            time=datetime(2025, 1, 1, 12, 10, 0),
            user_description="Hello, this is a test of the audio generation system. The forest looks absolutely beautiful this morning.",
            participant="unknown",
            file=StoryFileInfo(
                s3_key="",
                file_type="upload",
                file_name="test_voice.mp3",
                size=1,
            ),
        ),
    ]
    
    # Initialize service
    service = MediaGeneratorService(
        job_id="comprehensive-test",
        batch_size=1,
        retry_attempts=1,
    )
    
    print("🚀 Starting media generation (this will take 2-3 minutes)...\n")
    start_time = datetime.now()
    
    updated_stories = await service.generate_media_for_stories(
        stories=stories,
        entities={},
    )
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print("\n" + "="*70)
    print("RESULTS")
    print("="*70)
    
    success_count = 0
    for story in updated_stories:
        has_media = bool(story.file.s3_key)
        icon = "✅" if has_media else "❌"
        
        print(f"\n{icon} {story.story_type.name}: {story.uid}")
        print(f"   Description: {story.user_description[:60]}...")
        
        if has_media:
            print(f"   S3 Key: {story.file.s3_key}")
            print(f"   Size: {story.file.size:,} bytes ({story.file.size / 1024 / 1024:.2f} MB)")
            success_count += 1
        else:
            print(f"   Status: FAILED (story removed)")
    
    print(f"\n{'='*70}")
    print(f"Summary: {success_count}/{len(stories)} succeeded")
    print(f"Duration: {duration:.1f} seconds")
    print(f"{'='*70}\n")
    
    if success_count == len(stories):
        print("🎉 ALL TESTS PASSED!\n")
        return True
    else:
        print("💥 SOME TESTS FAILED\n")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_all_media())
    exit(0 if result else 1)
