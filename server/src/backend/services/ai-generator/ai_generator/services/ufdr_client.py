"""
UFDR Job Submission Client.

This module handles HTTP communication with the UFDR (Universal Forensic Data Repository)
endpoint for submitting GenerationJobs.
"""
import json
import os
import uuid

import httpx
from typing import Optional

from model.job import GenerationJob
from pydantic import BaseModel


class UFDRSubmissionResponse(BaseModel):
    """Response from UFDR job submission."""
    
    job_id: str
    status: str
    message: Optional[str] = None
    success: bool = True


class UFDRSubmissionError(BaseModel):
    """Error response from UFDR job submission."""
    
    job_id: str
    error: str
    success: bool = False


class UFDRClient:
    """
    HTTP client for submitting GenerationJobs to UFDR endpoint.
    
    The UFDR endpoint accepts GenerationJob payloads and returns
    submission confirmation.
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        """
        Initialize UFDR client.
        
        Args:
            base_url: UFDR API base URL. If None, reads from UFDR_API_URL env var
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or os.getenv(
            "UFDR_API_URL",
            "https://rx28yav780-vpce-07a1401965d8a8c77.execute-api.eu-central-1.amazonaws.com/prod"
        )
        self.timeout = timeout
        self.job_endpoint = f"{self.base_url}/UFDR/job"
    
    async def submit_job(
        self,
        job_data: GenerationJob,
    ) -> UFDRSubmissionResponse | UFDRSubmissionError:
        """
        Submit a GenerationJob to UFDR endpoint.
        
        Args:
            job_data: Serialized GenerationJob dict (from job.model_dump())
            
        Returns:
            UFDRSubmissionResponse on success, UFDRSubmissionError on failure
            
        Raises:
            httpx.HTTPError: On network/connection errors
        """
        job_id = str(uuid.uuid4())
        job_data.job_id = job_id
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    self.job_endpoint,
                    json=json.loads(job_data.model_dump_json()),
                    headers={
                        "Content-Type": "application/json",
                    },
                )
                
                response.raise_for_status()
                
                # Parse successful response
                response_data = response.json()
                return UFDRSubmissionResponse(
                    job_id=job_data.job_id,
                    status=response_data.get("status", "submitted"),
                    message=response_data.get("message"),
                    success=True,
                )
                
            except httpx.HTTPStatusError as e:
                # Handle HTTP errors (4xx, 5xx)
                error_detail = f"HTTP {e.response.status_code}: {e.response.text}"
                return UFDRSubmissionError(
                    job_id=job_data.job_id,
                    error=error_detail,
                    success=False,
                )
            
            except Exception as e:
                # Handle other errors (network, timeout, etc.)
                return UFDRSubmissionError(
                    job_id=job_data.job_id,
                    error=f"Submission failed: {str(e)}",
                    success=False,
                )
    
    async def submit_jobs_batch(
        self,
        jobs: list[dict],
    ) -> list[UFDRSubmissionResponse | UFDRSubmissionError]:
        """
        Submit multiple GenerationJobs in parallel.
        
        Args:
            jobs: List of serialized GenerationJob dicts
            
        Returns:
            List of submission responses (one per job)
        """
        import asyncio
        
        tasks = [self.submit_job(job) for job in jobs]
        results = await asyncio.gather(*tasks, return_exceptions=False)
        
        return results
