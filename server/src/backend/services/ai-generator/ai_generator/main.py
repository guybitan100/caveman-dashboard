"""Command-line interface for the AI story generation pipeline."""

import asyncio
import sys

from ai_generator.pipeline import Pipeline


async def main():
    """Run the AI story generation pipeline."""
    if len(sys.argv) < 2:
        description = "A detective investigating a murder in a small town"
        print(f"No description provided. Using default: {description}")
    else:
        description = sys.argv[1]
    
    print("=" * 60)
    print("AI STORY GENERATION PIPELINE")
    print("=" * 60)
    print(f"\nInput: {description}\n")
    
    pipeline = Pipeline()
    
    try:
        session_id, result = await pipeline.run(description)
        
        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE!")
        print("=" * 60)
        print(f"\nSession ID: {session_id}")
        print(f"Total stories generated: {result.total_stories_generated}")
        print(f"Total jobs created: {result.total_jobs_created}")
        print(f"\nResults saved to: ./pipeline_sessions/{session_id}/")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
