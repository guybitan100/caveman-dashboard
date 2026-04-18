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

DEFAULT_TITAN_HOST = "titan.cellebrite.cto"


class TitanClientError(Exception):
    pass


def _handle_titan_client_errors(func: Callable) -> Callable:

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except TitanClientError as e:
            raise e
        except HTTPError as e:
            raise TitanClientError("Titan connection problem") from e
        except Exception as e:
            raise TitanClientError(f"Error in Titan client: {e}") from e

    return wrapper


class TitanClient:

    def __init__(self, host: str = DEFAULT_TITAN_HOST):
        host = host if host.startswith("http://") else f"http://{host}"
        self._url = f"{host}/UFDR"

        self._verify_connection(host=host)

    @staticmethod
    def _verify_connection(host: str):
        try:
            logger.info(f"Verifying Titan connectivity at host {host}")
            requests.get(host)
        except ConnectionError:
            raise TitanClientError(f'Cannot connect to Titan at host "{host}"')

    @_handle_titan_client_errors
    def create_job(self, job: GenerationJob) -> str:
        logger.info("Creating job...")
        response = requests.post(f"{self._url}/job", data=job.json())
        response.raise_for_status()
        job_id = response.json()["job_id"]
        logger.info(f"Created job {job_id}")
        return job_id

    @_handle_titan_client_errors
    def get_job_status(self, job_id: str) -> JobStatus:
        response = requests.get(f"{self._url}/job/status/{job_id}")
        response.raise_for_status()
        job_status = JobStatus(response.json())
        return job_status

    @_handle_titan_client_errors
    def cancel_job(self, job_id: str):
        logger.info(f"Cancelling job {job_id}")
        response = requests.post(f"{self._url}/job/cancel/{job_id}")
        response.raise_for_status()

    @_handle_titan_client_errors
    def delete_job(self, job_id: str):
        logger.info(f"Deleting job {job_id}")
        response = requests.delete(f"{self._url}/job/{job_id}")
        response.raise_for_status()

    @_handle_titan_client_errors
    def download_ufdr(self, job_id: str, dir_path: str | PathLike):
        dir_path = Path(dir_path)
        if not dir_path.is_dir():
            raise TitanClientError(f'"{dir_path}" is not a directory')

        job_status = self.get_job_status(job_id=job_id)
        if job_status != JobStatus.Done:
            raise TitanClientError(
                f"Job is not done, UFDR cannot be downloaded (status={job_status.value})"
            )

        logger.info(f"Retrieving UFDR download link for job {job_id}")
        response = requests.get(f"{self._url}/download/{job_id}")
        response.raise_for_status()
        download_url = response.json()

        ufdr_filename = urlparse(download_url).path.rsplit("/", 1)[-1]
        ufdr_filepath = dir_path / ufdr_filename

        logger.info(
            f'Downloading UFDR for job {job_id} to path "{ufdr_filepath.resolve()}"...'
        )
        with requests.get(download_url, stream=True) as r:
            with ufdr_filepath.open("wb") as f:
                shutil.copyfileobj(r.raw, f)
        logger.info(f"Downloaded UFDR for job {job_id}")
