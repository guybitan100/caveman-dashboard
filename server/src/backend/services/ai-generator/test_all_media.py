"""
Comprehensive test for all media types (image, video, audio, document)
"""
import asyncio
from ai_generator.models.story_output import Story
from ai_generator.models.entity import Entity, VoiceCharacteristics
from ai_generator.services.media_generator_service import MediaGeneratorService

async def test_all_media_types():
    print("\n" + "="*60)
    print("Testing ALL Media Generation Types")
    print("="*60 + "\n")
    
    # Create test stories for each media type
    stories = [
        Story(
            id="test-img-002",
            job_id="comprehensive-test-001",
            title="Mountain Sunset",
            content="A beautiful sunset over mountains with orange and purple sky",
            location="",
            start_time=0,
            end_time=10,
            file_type="image",
            file_name="",
            s3_key="",
            size=0,
            entity_uids=[]
        ),
        Story(
            id="test-vid-001",
            job_id="comprehensive-test-001",
            title="Forest Walk",
            content="A peaceful walk through a misty forest at dawn with sunlight filtering through trees",
            location="",
            start_time=0,
            end_time=6,
            file_type="video",
            file_name="",
            s3_key="",
            size=0,
            entity_uids=[]
        ),
        Story(
            id="test-audio-001",
            job_id="comprehensive-test-001",
            title="Welcome Message",
            content="Welcome to the forest. Please enjoy your peaceful walk.",
            location="",
            start_time=0,
            end_time=5,
            file_type="audio",
            file_name="",
            s3_key="",
            size=0,
            entity_uids=["entity-001"]
        ),
        Story(
            id="test-doc-001",
            job_id="comprehensive-test-001",
            title="Research Report",
            content="This is a comprehensive research report about forest ecosystems. "
                   "Forests provide essential ecosystem services including carbon sequestration, "
                   "water filtration, and biodiversity habitat.",
            location="",
            start_time=0,
            end_time=0,
            file_type="document",
            file_name="",
            s3_key="",
            size=0,
            entity_uids=[]
        ),
    ]
    
    # Create test entity with voice characteristics
    entities = {
        "entity-001": Entity(
            uid="entity-001",
            name="Alex Morgan",
            phone="+1234567890",
            location="",
            voice_characteristics=VoiceCharacteristics(
                gender="male",
                age_range="adult",
                accent="american"
            )
        )
    }
    
    # Initialize service with smaller batch size for testing
    service = MediaGeneratorService(
        batch_size=2,
        retry_attempts=1
    )
    
    try:
        print(f"🚀 Generating media for {len(stories)} stories...\n")
        
        updated_stories = await service.generate_media(stories, entities)
        
        print("\n" + "="*60)
        print("Results Summary")
        print("="*60)
        
        for story in updated_stories:
            icon = "✅" if story.s3_key else "❌"
            print(f"\n{icon} {story.file_type.upper()}: {story.id}")
            print(f"   Title: {story.title}")
            if story.s3_key:
                print(f"   S3 Key: {story.s3_key}")
                print(f"   Size: {story.size:,} bytes")
            else:
                print(f"   Status: FAILED")
        
        success_count = sum(1 for s in updated_stories if s.s3_key)
        print(f"\n{'='*60}")
        print(f"Total: {success_count}/{len(stories)} succeeded")
        print(f"{'='*60}\n")
        
        return success_count == len(stories)
        
    finally:
        await service.cleanup()

if __name__ == "__main__":
    result = asyncio.run(test_all_media_types())
    exit(0 if result else 1)
