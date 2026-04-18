import shutil
from urllib.parse import urlparse
from functools import wraps
from os import PathLike
from pathlib import Path
from typing import Callable

import requests
from loguru import logger
from requests import HTTPError, ConnectionError

from model.status import JobStatus
from model.job import GenerationJob

DEFAULT_SIX_HOST = "six.cellebrite.cto"


class SixClientError(Exception):
    pass


def _handle_six_client_errors(func: Callable) -> Callable:
    """Decorator method for auto-handling SixClient connection and response errors"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except SixClientError as e:
            raise e
        except HTTPError as e:
            raise SixClientError("SiX connection problem") from e
        except Exception as e:
            raise SixClientError(f"Error in SiX client: {e}") from e

    return wrapper


class SixClient:
    """
    Create a new Cellebrite SiX client instance.

    Arguments:
        host: Cellebrite SiX host.
    """

    def __init__(self, host: str = DEFAULT_SIX_HOST):
        host = host if host.startswith("http://") else f"http://{host}"
        self._url = f"{host}/UFDR"

        self._verify_connection(host=host)

    @staticmethod
    def _verify_connection(host: str):
        try:
            logger.info(f"Verifying SiX connectivity at host {host}")
            requests.get(host)
        except ConnectionError:
            raise SixClientError(f'Cannot connect to SiX at host "{host}"')

    @_handle_six_client_errors
    def create_job(self, job: GenerationJob) -> str:
        """
        Create a new Cellebrite SiX job.

        Arguments:
            job: SiX job object.

        Returns:
            the id of the created job.
        """
        logger.info("Creating job...")
        response = requests.post(f"{self._url}/job", data=job.json())
        response.raise_for_status()
        job_id = response.json()["job_id"]
        logger.info(f"Created job {job_id}")
        return job_id

    @_handle_six_client_errors
    def get_job_status(self, job_id: str) -> JobStatus:
        """
        Get the status of a SiX job.

        Arguments:
            job_id: The id of the requested job.

        Returns:
            the status of the job.
        """
        response = requests.get(f"{self._url}/job/status/{job_id}")
        response.raise_for_status()
        job_status = JobStatus(response.json())
        return job_status

    @_handle_six_client_errors
    def cancel_job(self, job_id: str):
        """
        Cancel a SiX job.

        Arguments:
            job_id: The id of the requested job.
        """
        logger.info(f"Cancelling job {job_id}")
        response = requests.post(f"{self._url}/job/cancel/{job_id}")
        response.raise_for_status()

    @_handle_six_client_errors
    def delete_job(self, job_id: str):
        """
        Delete a SiX job.

        Arguments:
            job_id: The id of the requested job.
        """
        logger.info(f"Deleting job {job_id}")
        response = requests.delete(f"{self._url}/job/{job_id}")
        response.raise_for_status()

    @_handle_six_client_errors
    def download_ufdr(self, job_id: str, dir_path: str | PathLike):
        """
        Download a SiX generated UFDR.

        Arguments:
            job_id: The id of the requested job.
            dir_path: The path to download the file to.
        """
        dir_path = Path(dir_path)
        if not dir_path.is_dir():
            raise SixClientError(f'"{dir_path}" is not a directory')

        job_status = self.get_job_status(job_id=job_id)
        if job_status != JobStatus.Done:
            raise SixClientError(f"Job is not done, UFDR cannot be downloaded (status={job_status.value})")

        logger.info(f"Retrieving UFDR download link for job {job_id}")
        response = requests.get(f"{self._url}/download/{job_id}")
        response.raise_for_status()
        download_url = response.json()

        ufdr_filename = urlparse(download_url).path.rsplit("/", 1)[-1]
        ufdr_filepath = dir_path / ufdr_filename

        logger.info(f'Downloading UFDR for job {job_id} to path "{ufdr_filepath.resolve()}"...')
        with requests.get(download_url, stream=True) as r:
            with ufdr_filepath.open("wb") as f:
                shutil.copyfileobj(r.raw, f)
        logger.info(f"Downloaded UFDR for job {job_id}")
