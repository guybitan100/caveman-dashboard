#!/usr/bin/env python3

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ai_generator.pipeline import Pipeline
from ai_generator.storage import PipelineStorage


async def test_pipeline_with_app_stories():
    
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
    
    result = await test_pipeline_with_app_stories()
    return result


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code or 0)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
