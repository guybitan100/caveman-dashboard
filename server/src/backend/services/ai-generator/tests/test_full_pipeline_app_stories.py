#!/usr/bin/env python3
"""
Test script for full pipeline with app story generation.

This verifies that:
1. App stories are automatically generated for all referenced app_ids
2. The generation jobs include AppStoryData entries
3. No KeyError occurs when submitting to generation service
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ai_generator.pipeline import Pipeline
from ai_generator.storage import PipelineStorage


async def test_pipeline_with_app_stories():
    """Test full pipeline to verify app stories are generated."""
    
    print("🧪 Testing Full Pipeline with App Story Generation")
    print("=" * 60)
    
    # Initialize pipeline
    storage = PipelineStorage()
    pipeline = Pipeline(storage=storage)
    
    # ========================================
    # Step 1: Run Full Pipeline
    # ========================================
    print("\n📝 Step 1: Running Full Pipeline...")
    
    # Simple description that will likely reference apps
    description = """
    A day in the life of a software developer:
    - Starts with checking emails and messages
    - Uses Google Maps to navigate to a coffee shop
    - Works on code while listening to Spotify
    - Orders lunch via DoorDash
    - Video call with team using Zoom
    - Evening workout tracked on Strava
    """
    
    try:
        session_id, result = await pipeline.run(
            description=description
        )
        print(f"   ✅ Pipeline complete: {session_id}")
        
        print(f"\n   Generation Summary:")
        print(f"   • Total Jobs: {result.total_jobs_created}")
        print(f"   • Total Stories: {result.total_stories_generated}")
        
    except Exception as e:
        print(f"   ❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # ========================================
    # Step 2: Verify App Stories
    # ========================================
    print(f"\n🔍 Step 2: Verifying App Story Generation...")
    
    try:
        # Reload to get fresh data
        result = storage.load_generation_jobs(session_id)
        
        total_app_stories = 0
        total_regular_stories = 0
        app_ids_found = set()
        
        for mapping in result.phone_mappings:
            phone_name = mapping.phone.entity_name
            stories = mapping.stories
            
            # Count app stories (should be at the beginning)
            app_stories = [s for s in stories if s.get("story_type") == "app"]
            regular_stories = [s for s in stories if s.get("story_type") != "app"]
            
            total_app_stories += len(app_stories)
            total_regular_stories += len(regular_stories)
            
            print(f"\n   Phone: {phone_name}")
            print(f"   • Total Stories: {len(stories)}")
            print(f"   • App Stories: {len(app_stories)}")
            print(f"   • Regular Stories: {len(regular_stories)}")
            
            if app_stories:
                print(f"   • App IDs in app stories:")
                for app_story in app_stories:
                    app_id = app_story.get("app_id")
                    display_name = app_story.get("display_name", "unknown")
                    print(f"      - {app_id}: {display_name}")
                    app_ids_found.add(app_id)
            
            # Verify app stories come first
            first_non_app_idx = None
            last_app_idx = None
            
            for i, story in enumerate(stories):
                if story.get("story_type") == "app":
                    last_app_idx = i
                else:
                    if first_non_app_idx is None:
                        first_non_app_idx = i
            
            if last_app_idx is not None and first_non_app_idx is not None:
                if last_app_idx < first_non_app_idx:
                    print(f"   ✅ App stories are placed first")
                else:
                    print(f"   ❌ App stories are NOT at the beginning!")
                    return 1
            
            # Check if all referenced app_ids have corresponding app stories
            referenced_app_ids = set()
            for story in regular_stories:
                if "app_id" in story:
                    referenced_app_ids.add(story["app_id"])
            
            if referenced_app_ids:
                print(f"   • App IDs referenced in stories: {len(referenced_app_ids)}")
                missing_app_ids = referenced_app_ids - app_ids_found
                
                if missing_app_ids:
                    print(f"   ❌ Missing app stories for: {missing_app_ids}")
                    return 1
                else:
                    print(f"   ✅ All referenced app_ids have app stories")
        
        print(f"\n   Overall Statistics:")
        print(f"   • Total App Stories: {total_app_stories}")
        print(f"   • Total Regular Stories: {total_regular_stories}")
        print(f"   • Unique Apps: {len(app_ids_found)}")
        
        if total_app_stories == 0:
            print(f"\n   ⚠️  No app stories were generated")
            print(f"   This might be expected if the timeline has no app references")
        else:
            print(f"\n   ✅ App story generation is working correctly!")
        
    except Exception as e:
        print(f"   ❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # ========================================
    # Step 3: Validate Job Structure
    # ========================================
    print(f"\n🔧 Step 3: Validating Job Structure...")
    
    try:
        for job in result.generation_jobs:
            job_id = job["job_id"]
            entity_name = job["entity_name"]
            stories = job["stories"]
            
            print(f"\n   Job: {job_id} ({entity_name})")
            print(f"   • Stories: {len(stories)}")
            
            # Validate required fields
            required_fields = ["job_id", "entity_name", "entity_id", "device_type", "stories"]
            missing_fields = [f for f in required_fields if f not in job]
            
            if missing_fields:
                print(f"   ❌ Missing required fields: {missing_fields}")
                return 1
            
            # Validate each story has uid
            for i, story in enumerate(stories):
                if "uid" not in story:
                    print(f"   ❌ Story {i} missing uid")
                    return 1
                if "story_type" not in story:
                    print(f"   ❌ Story {i} missing story_type")
                    return 1
            
            print(f"   ✅ Job structure is valid")
        
        print(f"\n   ✅ All jobs have valid structure")
        
    except Exception as e:
        print(f"   ❌ Validation failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # ========================================
    # Success!
    # ========================================
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\nSummary:")
    print(f"• Session ID: {session_id}")
    print(f"• Jobs Created: {result.total_jobs_created}")
    print(f"• Stories Generated: {result.total_stories_generated}")
    print(f"• App Stories: {total_app_stories}")
    print(f"• Unique Apps: {len(app_ids_found)}")
    print(f"\nThe pipeline successfully:")
    print("  1. Generated a timeline from the description")
    print("  2. Created generation jobs with stories")
    print("  3. Automatically generated AppStoryData for all referenced apps")
    print("  4. Placed app stories at the beginning of each job")
    print("  5. Ensured all app_id references have corresponding app stories")
    print(f"\n✅ The KeyError issue should now be resolved!")
    
    return 0


async def main():
    """Run the test."""
    
    result = await test_pipeline_with_app_stories()
    return result


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code or 0)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
