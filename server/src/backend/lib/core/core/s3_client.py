from functools import cached_property, wraps
from typing import IO, Callable, Any

import boto3
from botocore.config import Config
from mypy_boto3_s3 import S3Client
from botocore.exceptions import ClientError

from core.config import SETTINGS
from core.six_logger import logger

_FILE_DL_UL_EXPIRES_SECONDS = 60 * 60 * 24   # 24 hours


class S3ClientError(Exception):
    def __init__(self, *args, **kwargs):
        super().__init__(args, kwargs)


def _handle_s3_client_errors(func: Callable) -> Callable:
    """Decorator method for auto-handling MetaFinder connection and response errors"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except S3ClientError as e:
            raise e
        except ClientError as e:
            raise S3ClientError("S3 connection problem", e)
        except Exception as e:
            raise S3ClientError(f"Error in boto3 client: {e}", e)

    return wrapper


class SixS3Client:
    def __init__(self, validate_connection: bool = False):
        if validate_connection:
            self.check_connection()

    @cached_property
    def _client(self) -> S3Client:
        session = boto3.Session()
        client = session.client("s3",config=Config(signature_version='s3v4'), region_name=SETTINGS.AWS_REGION)
        return client

    def check_connection(self):
        try:
            self._client.head_bucket(Bucket=SETTINGS.S3_SIX_BUCKET_NAME)
        except ClientError as e:
            logger.error('Connection to AWS S3 failed', error=e)
            raise S3ClientError(e)

    @_handle_s3_client_errors
    def upload_file(self, file_obj: IO, bucket_name: str, file_name: str):
        self._client.upload_fileobj(file_obj, bucket_name, file_name)

    @_handle_s3_client_errors
    def upload_object(self, bucket_name: str, file_name: str, obj: Any):
        self._client.put_object(Bucket=bucket_name, Key=file_name, Body=obj)

    @_handle_s3_client_errors
    def download_object(self, bucket_name: str, file_name: str) -> Any:
        return self._client.get_object(Bucket=bucket_name, Key=file_name)['Body'].read()

    @_handle_s3_client_errors
    def does_prefix_exist(self, prefix: str, bucket_name: str) -> bool:
        try:
            resp = self._client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
            if len(resp['Contents']) > 0:
                return True
        except KeyError:  # Will be raised in case no file is matching the prefix
            return False

    def get_download_presigned_url(self, bucket_name, file_name, expires_in: int = _FILE_DL_UL_EXPIRES_SECONDS) -> str:
        presigned_url = self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket_name, "Key": file_name},
            ExpiresIn=expires_in
        )
        return presigned_url

    def get_upload_presigned_url(self, bucket_name, file_name, expires_in: int = _FILE_DL_UL_EXPIRES_SECONDS) -> dict[str, Any]:
        return self._client.generate_presigned_post(Bucket=bucket_name, Key=file_name,
                                                    ExpiresIn=expires_in)

    @_handle_s3_client_errors
    def get_file_size(self, bucket_name: str, file_name) -> int:
        response = self._client.head_object(Bucket=bucket_name, Key=file_name)
        return response["ContentLength"]

    @_handle_s3_client_errors
    def download_file(self, bucket_name: str, s3_key: str, file_name: str):
        self._client.download_file(Bucket=bucket_name, Key=s3_key, Filename=file_name)

    @_handle_s3_client_errors
    def delete_object(self, bucket_name: str, file_name: str):
        self._client.delete_object(Bucket=bucket_name, Key=file_name)
