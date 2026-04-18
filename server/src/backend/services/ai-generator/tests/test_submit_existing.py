#!/usr/bin/env python3

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ai_generator.pipeline import Pipeline
from ai_generator.storage import PipelineStorage
from ai_generator.workflows import TimelineToJobsWorkflow


async def test_submit_existing_session():
    
    print("🧪 Testing submit_existing_session functionality")
    print("=" * 60)
    
    # Initialize storage and workflow
    storage = PipelineStorage()
    workflow = TimelineToJobsWorkflow(storage=storage)
    
    # ========================================
    # Step 1: Find an existing session with jobs
    # ========================================
    print("\n📁 Step 1: Finding existing sessions...")
    
    try:
        # List all sessions
        sessions_dir = storage.base_path
        if not sessions_dir.exists():
            print("❌ No sessions directory found")
            return 1
        
        session_dirs = [d for d in sessions_dir.iterdir() if d.is_dir()]
        
        if not session_dirs:
            print("❌ No sessions found")
            print("\nℹ️  To test this function:")
            print("   1. Run the full pipeline with submit_to_ufdr=False")
            print("   2. Then use submit_existing_session() to submit those jobs")
            return 1
        
        # Find a session with generation jobs
        session_id = None
        for session_dir in sorted(session_dirs, reverse=True):
            sid = session_dir.name
            try:
                result = storage.load_generation_jobs(sid)
                if result.generation_jobs:
                    session_id = sid
                    print(f"✅ Found session with jobs: {session_id}")
                    print(f"   Jobs: {len(result.generation_jobs)}")
                    print(f"   Stories: {result.total_stories_generated}")
                    
                    # Check if already submitted
                    if result.all_jobs_submitted:
                        print(f"   ⚠️  Jobs already submitted - will re-submit")
                    else:
                        print(f"   ✓ Jobs not yet submitted")
                    break
            except (FileNotFoundError, Exception):
                continue
        
        if not session_id:
            print("❌ No sessions with GenerationJobs found")
            print("\nℹ️  Create a session first:")
            print("   session_id, result = await pipeline.run(")
            print("       description='...',")
            print("       submit_to_ufdr=False")
            print("   )")
            return 1
        
    except Exception as e:
        print(f"❌ Error finding sessions: {e}")
        return 1
    
    # ========================================
    # Step 2: Load and display job details
    # ========================================
    print(f"\n📊 Step 2: Loading job details from session {session_id}...")
    
    try:
        result = storage.load_generation_jobs(session_id)
        
        print(f"\n   Session Information:")
        print(f"   • Total Jobs: {result.total_jobs_created}")
        print(f"   • Total Stories: {result.total_stories_generated}")
        print(f"   • Phones:")
        
        for i, mapping in enumerate(result.phone_mappings, 1):
            print(f"      {i}. {mapping.phone.entity_name}")
            print(f"         Device: {mapping.phone.device_type}")
            print(f"         Stories: {len(mapping.stories)}")
        
        if result.ufdr_submissions:
            print(f"\n   Previous Submission Status:")
            for sub in result.ufdr_submissions:
                status = "✅" if sub.success else "❌"
                print(f"      {status} {sub.phone_entity_name}: {sub.job_id}")
                if sub.error:
                    print(f"         Error: {sub.error}")
        
    except Exception as e:
        print(f"❌ Error loading job details: {e}")
        return 1
    
    # ========================================
    # Step 3: Submit to UFDR
    # ========================================
    print(f"\n🚀 Step 3: Submitting jobs to UFDR...")
    print("   (This will make HTTP requests to the UFDR endpoint)")
    
    # Ask for confirmation (skip in automated tests)
    if sys.stdin.isatty():
        response = input("\n   Continue with submission? (y/N): ")
        if response.lower() != 'y':
            print("   Submission cancelled")
            return 0
    
    try:
        # Submit the existing session
        updated_result = await workflow.submit_existing_session(session_id)
        
        # ========================================
        # Step 4: Display results
        # ========================================
        print(f"\n✅ Step 4: Submission complete!")
        print(f"\n   Submission Results:")
        
        success_count = 0
        for sub in updated_result.ufdr_submissions:
            if sub.success:
                print(f"      ✅ {sub.phone_entity_name}")
                print(f"         Job ID: {sub.job_id}")
                if sub.message:
                    print(f"         Message: {sub.message}")
                success_count += 1
            else:
                print(f"      ❌ {sub.phone_entity_name}")
                print(f"         Job ID: {sub.job_id}")
                print(f"         Error: {sub.error}")
        
        print(f"\n   Summary:")
        print(f"   • Submitted: {success_count}/{len(updated_result.ufdr_submissions)} jobs")
        print(f"   • All Successful: {'Yes' if updated_result.all_jobs_submitted else 'No'}")
        
        if updated_result.all_jobs_submitted:
            print("\n🎉 All jobs submitted successfully!")
            return 0
        else:
            print("\n⚠️  Some jobs failed to submit")
            return 1
        
    except FileNotFoundError as e:
        print(f"❌ Session not found: {e}")
        return 1
    except ValueError as e:
        print(f"❌ Invalid session: {e}")
        return 1
    except Exception as e:
        print(f"❌ Error during submission: {e}")
        import traceback
        traceback.print_exc()
        return 1


async def demonstrate_workflow():
    
    print("\n\n" + "=" * 60)
    print("📚 WORKFLOW DEMONSTRATION")
    print("=" * 60)
    
    print("\nThis function enables a 2-step workflow:")
    print()
    print("Step 1: Generate jobs WITHOUT submitting")
    print("─" * 60)
    print("""
    pipeline = Pipeline()
    
    session_id, result = await pipeline.run(
        description="A detective investigates...",
        submit_to_ufdr=False  # Don't submit yet
    )
    
    # Review the generated jobs
    print(f"Created {result.total_jobs_created} jobs")
    print(f"Total stories: {result.total_stories_generated}")
    # Submit when ready using workflow
    workflow = TimelineToJobsWorkflow()
    result = await workflow.submit_existing_session(session_id)
    
    # Check results
    if result.all_jobs_submitted:
        print("All jobs submitted successfully!")
    
    # Show demonstration
    await demonstrate_workflow()
    
    # Run actual test
    result = await test_submit_existing_session()
    
    print("\n" + "=" * 60)
    return result


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code or 0)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
