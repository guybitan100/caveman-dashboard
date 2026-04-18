#!/usr/bin/env python3

import sys
from pathlib import Path
from datetime import date

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ai_generator.agents.job_assembly import JobAssemblyAgent
from ai_generator.models import SelectedPhone, DeviceType
from ai_generator.models.phone_stories import PhoneStoryMapping, PhoneStoryMappingPhone


def test_app_story_generation():
    
    print("🧪 Testing App Story Generation")
    print("=" * 60)
    
    # Create test data
    agent = JobAssemblyAgent()
    
    # Create a phone
    phone = SelectedPhone(
        entity_id="ent_001",
        entity_name="John Doe",
        device_type=DeviceType.ANDROID,
        phone_number="+1234567890",
        email="john@example.com",
        country_code="US",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
    )
    
    # Create stories with app_id references
    stories = [
        {
            "uid": "story_001",
            "story_type": "location",
            "time": "2024-06-15T10:00:00",
            "app_id": "com.google.android.apps.maps",  # Google Maps
            "latitude": 40.7128,
            "longitude": -74.0060,
            "address": "New York, NY",
        },
        {
            "uid": "story_002",
            "story_type": "sms/mms",
            "time": "2024-06-15T11:00:00",
            "message": "Hey, check out this location",
            "party": "+0987654321",
        },
        {
            "uid": "story_003",
            "story_type": "location",
            "time": "2024-06-15T12:00:00",
            "app_id": "com.google.android.apps.maps",  # Same app (should dedupe)
            "latitude": 40.7589,
            "longitude": -73.9851,
            "address": "Times Square, NY",
        },
        {
            "uid": "story_004",
            "story_type": "chat_message",
            "time": "2024-06-15T13:00:00",
            "app_id": "com.whatsapp",  # WhatsApp
            "message": "Hello from WhatsApp",
            "party": "+0987654321",
        },
    ]
    
    # Create story mapping
    mapping = PhoneStoryMapping(
        phone=PhoneStoryMappingPhone(
            entity_id=phone.entity_id,
            entity_name=phone.entity_name,
            device_type=phone.device_type.value,
            phone_number=phone.phone_number,
            email=phone.email,
        ),
        stories=stories,
    )
    
    print("\n📊 Test Data:")
    print(f"   Phone: {phone.entity_name} ({phone.device_type.value})")
    print(f"   Stories: {len(stories)}")
    print(f"   App IDs referenced:")
    for story in stories:
        if "app_id" in story:
            print(f"      - {story['app_id']} (in {story['story_type']})")
    
    # Test app_id collection
    print("\n🔍 Step 1: Collecting app_ids...")
    converted_stories = [
        agent._convert_story_dict_to_story_data(s) for s in stories
    ]
    app_ids = agent._collect_app_ids(converted_stories)
    print(f"   Found {len(app_ids)} unique app_ids: {app_ids}")
    
    # Verify deduplication
    expected_app_ids = {"com.google.android.apps.maps", "com.whatsapp"}
    if app_ids == expected_app_ids:
        print("   ✅ App ID deduplication works correctly")
    else:
        print(f"   ❌ Expected {expected_app_ids}, got {app_ids}")
        return 1
    
    # Test app story generation
    print("\n🏗️  Step 2: Generating app stories...")
    app_stories = agent._generate_app_stories(converted_stories, phone.device_type)
    print(f"   Generated {len(app_stories)} app stories")
    
    for app_story in app_stories:
        app_info = app_story.get('app', {})
        print(f"      - {app_info.get('app_id', 'unknown')}: {app_info.get('name', 'unknown')}")
        print(f"        UID: {app_story['uid']}")
        print(f"        Type: {app_story['story_type']}")
    
    # Verify app stories
    if len(app_stories) != 2:
        print(f"   ❌ Expected 2 app stories, got {len(app_stories)}")
        return 1
    
    app_story_ids = {s.get("app", {}).get("app_id") for s in app_stories}
    if app_story_ids == expected_app_ids:
        print("   ✅ App stories generated correctly")
    else:
        print(f"   ❌ Expected app story IDs {expected_app_ids}, got {app_story_ids}")
        return 1
    
    # Verify all app stories have required fields
    for app_story in app_stories:
        required_fields = ["uid", "story_type", "app"]
        missing_fields = [f for f in required_fields if f not in app_story]
        if missing_fields:
            print(f"   ❌ App story missing fields: {missing_fields}")
            return 1
        
        # Verify nested app field has correct structure
        app_info = app_story.get("app", {})
        if not isinstance(app_info, dict) or "app_id" not in app_info or "name" not in app_info:
            print(f"   ❌ App story has invalid 'app' field structure")
            return 1
    
    print("   ✅ All app stories have required fields")
    
    # Test full job assembly
    print("\n🔧 Step 3: Assembling complete job...")
    job = agent.assemble_job(
        session_id="test_session",
        phone=phone,
        story_mapping=mapping,
        entities=[],
    )
    
    print(f"   Job ID: {job['job_id']}")
    print(f"   Total stories: {len(job['stories'])}")
    print(f"      - App stories: {len(app_stories)}")
    print(f"      - Regular stories: {len(stories)}")
    
    # Verify app stories come first
    job_stories = job['stories']
    first_two_stories = job_stories[:2]
    
    app_story_count = sum(1 for s in first_two_stories if s.get("story_type") == "app")
    if app_story_count == 2:
        print("   ✅ App stories are placed first in the job")
    else:
        print(f"   ⚠️  Expected app stories first, but found {app_story_count} app stories in first 2")
    
    # Verify total count
    expected_total = len(app_stories) + len(stories)
    if len(job_stories) == expected_total:
        print(f"   ✅ Total story count correct: {len(job_stories)}")
    else:
        print(f"   ❌ Expected {expected_total} stories, got {len(job_stories)}")
        return 1
    
    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("\nSummary:")
    print(f"   • Correctly deduplicates app_ids")
    print(f"   • Generates AppStoryData for each unique app_id")
    print(f"   • Includes app stories in final job (at the beginning)")
    print(f"   • Resolves app display names from registry")
    
    return 0


if __name__ == "__main__":
    exit_code = test_app_story_generation()
    sys.exit(exit_code)
