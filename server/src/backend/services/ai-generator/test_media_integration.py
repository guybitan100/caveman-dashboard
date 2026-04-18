#!/usr/bin/env python3

import asyncio
from datetime import datetime

from ai_generator.models.story_output import (
    ImageStoryOutput,
    StoryFileInfo,
)
from ai_generator.services.media_generator_service import MediaGeneratorService
from model.stories import StoryType

async def test_image_generation():
    print("=" * 60)
    print("Testing Media Generation Integration")
    print("=" * 60)
    
    # Create a sample image story
    test_story = ImageStoryOutput(
        uid="test-img-001",
        story_type=StoryType.IMAGE,
        time=datetime(2025, 1, 1, 12, 0, 0),
        user_description="A beautiful sunset over mountains with orange and purple sky",
        file=StoryFileInfo(
            s3_key="",  # Will be populated by media generation
            file_type="upload",
            file_name="test_sunset.png",
            size=1,
        ),
    )
    
    print(f"\n📸 Testing with story: {test_story.uid}")
    print(f"Description: {test_story.user_description}")
    print(f"Initial S3 key: '{test_story.file.s3_key}'")
    
    # Initialize the media generator service
    service = MediaGeneratorService(
        job_id="integration-test-001",
        batch_size=1,
        retry_attempts=1,
    )
    
    print("\n🚀 Starting media generation...")
    
    # Generate media
    try:
        updated_stories = await service.generate_media_for_stories(
            stories=[test_story],
            entities={},
        )
        
        if updated_stories:
            result_story = updated_stories[0]
            print("\n✅ Media generation SUCCEEDED!")
            print(f"S3 Key: {result_story.file.s3_key}")
            print(f"File Name: {result_story.file.file_name}")
            print(f"File Size: {result_story.file.size} bytes")
            print(f"S3 URI: s3://engineenvdevenginestack787311f4-jobsbucket5eadc5ca-fug89fwmobpt/{result_story.file.s3_key}")
            return True
        else:
            print("\n❌ Media generation FAILED - story was removed")
            return False
            
    except Exception as e:
        print(f"\n❌ Media generation ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("\n🔧 Checking AWS credentials...")
    import boto3
    try:
        sts = boto3.client('sts', region_name='eu-central-1')
        identity = sts.get_caller_identity()
        print(f"✅ AWS Account: {identity['Account']}")
        print(f"✅ AWS User/Role: {identity['Arn']}")
    except Exception as e:
        print(f"⚠️  AWS credentials issue: {e}")
        print("Make sure you have valid AWS credentials configured")
    
    print("\n🔧 Checking Bedrock access...")
    try:
        bedrock = boto3.client('bedrock', region_name='eu-central-1')
        # Just check if we can connect
        print("✅ Bedrock client initialized")
    except Exception as e:
        print(f"⚠️  Bedrock access issue: {e}")
    
    print("\n" + "=" * 60)
    success = asyncio.run(test_image_generation())
    print("=" * 60)
    
    if success:
        print("\n🎉 Integration test PASSED!")
    else:
        print("\n💥 Integration test FAILED!")
    
    exit(0 if success else 1)
