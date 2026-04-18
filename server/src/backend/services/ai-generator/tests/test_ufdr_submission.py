#!/usr/bin/env python3
"""
Test script for UFDR job submission.

This script tests the UFDR client by creating a mock GenerationJob
and attempting to submit it.
"""

import asyncio
import sys
from datetime import date
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ai_generator.services.ufdr_client import UFDRClient


async def test_ufdr_submission():
    """Test UFDR job submission with a mock job."""
    
    print("🧪 Testing UFDR Job Submission")
    print("=" * 50)
    
    # Create a minimal mock GenerationJob
    mock_job = {
        "job_id": "test_job_123",
        "name": "Test AI Generated Job",
        "tasks": [],
        "context": {
            "device_info": {
                "os": "iOS",
                "model": "iPhone 15 Pro",
                "metadata": [
                    {"key": "ai_generated", "value": "true"},
                    {"key": "test", "value": "true"}
                ]
            },
            "start_date": date(2024, 1, 1).isoformat(),
            "end_date": date.today().isoformat(),
            "country_info": "US",
        },
        "stories": [
            {
                "uid": "story_001",
                "story_type": "sms/mms",
                "time": "2024-06-15T10:30:00",
                "message": "Test message",
            }
        ],
        "owner_entity": {
            "name": "Test User",
            "phone": "+1234567890",
            "email": "test@example.com"
        },
        "entities": []
    }
    
    # Create UFDR client
    print("\n📡 Creating UFDR client...")
    client = UFDRClient()
    print(f"   Endpoint: {client.job_endpoint}")
    
    # Submit the job
    print("\n🚀 Submitting test job...")
    print(f"   Job ID: {mock_job['job_id']}")
    
    try:
        response = await client.submit_job(mock_job)
        
        print("\n📊 Submission Result:")
        print(f"   Success: {response.success}")
        print(f"   Job ID: {response.job_id}")
        
        if response.success:
            print(f"   Status: {getattr(response, 'status', 'unknown')}")
            message = getattr(response, 'message', None)
            if message:
                print(f"   Message: {message}")
            print("\n✅ Job submitted successfully!")
        else:
            error = getattr(response, 'error', 'unknown error')
            print(f"   Error: {error}")
            print("\n❌ Job submission failed")
            return 1
            
    except Exception as e:
        print(f"\n❌ Exception during submission: {e}")
        return 1
    
    print("\n" + "=" * 50)
    print("🎉 Test complete!")
    return 0


async def test_batch_submission():
    """Test batch submission with multiple jobs."""
    
    print("\n\n🧪 Testing Batch UFDR Job Submission")
    print("=" * 50)
    
    # Create two mock jobs
    jobs = [
        {
            "job_id": f"test_batch_job_{i}",
            "name": f"Test Batch Job {i}",
            "tasks": [],
            "context": {
                "device_info": {
                    "os": "iOS" if i == 0 else "Android",
                    "model": "iPhone 15 Pro" if i == 0 else "Samsung Galaxy S24",
                },
                "start_date": date(2024, 1, 1).isoformat(),
                "end_date": date.today().isoformat(),
                "country_info": "US",
            },
            "stories": [],
            "owner_entity": {
                "name": f"Test User {i}",
                "phone": f"+123456789{i}",
            },
            "entities": []
        }
        for i in range(2)
    ]
    
    print(f"\n📦 Submitting {len(jobs)} jobs in batch...")
    
    client = UFDRClient()
    
    try:
        responses = await client.submit_jobs_batch(jobs)
        
        print("\n📊 Batch Submission Results:")
        success_count = 0
        for i, response in enumerate(responses):
            print(f"\n   Job {i+1}:")
            print(f"     Success: {response.success}")
            print(f"     Job ID: {response.job_id}")
            if response.success:
                success_count += 1
            else:
                print(f"     Error: {getattr(response, 'error', 'unknown')}")
        
        print(f"\n   Total: {success_count}/{len(jobs)} jobs submitted successfully")
        
        if success_count == len(jobs):
            print("\n✅ Batch submission successful!")
            return 0
        else:
            print("\n⚠️  Some jobs failed")
            return 1
            
    except Exception as e:
        print(f"\n❌ Exception during batch submission: {e}")
        return 1


async def main():
    """Run all tests."""
    
    # Test single submission
    result1 = await test_ufdr_submission()
    
    # Test batch submission
    result2 = await test_batch_submission()
    
    # Return exit code
    return max(result1, result2)


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
