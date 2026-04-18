from unittest.mock import patch, MagicMock, PropertyMock

import pytest
from botocore.exceptions import ClientError

from core.s3_client import TitanS3Client, S3ClientError, _handle_s3_client_errors


class TestS3ClientError:
    def test_init(self):
        err = S3ClientError("msg", "detail")
        assert isinstance(err, Exception)


class TestHandleS3ClientErrors:
    def test_wraps_client_error(self):
        @_handle_s3_client_errors
        def failing():
            raise ClientError({"Error": {"Code": "403"}}, "op")

        with pytest.raises(S3ClientError):
            failing()

    def test_wraps_generic_error(self):
        @_handle_s3_client_errors
        def failing():
            raise RuntimeError("oops")

        with pytest.raises(S3ClientError):
            failing()

    def test_passes_s3_client_error_through(self):
        @_handle_s3_client_errors
        def failing():
            raise S3ClientError("already wrapped")

        with pytest.raises(S3ClientError, match="already wrapped"):
            failing()


class TestTitanS3Client:
    def _make_client(self):
        client = TitanS3Client.__new__(TitanS3Client)
        client.__dict__["_client"] = MagicMock()
        return client

    def test_upload_file(self):
        c = self._make_client()
        c.upload_file(file_obj=MagicMock(), bucket_name="b", file_name="f")
        c._client.upload_fileobj.assert_called_once()

    def test_upload_object(self):
        c = self._make_client()
        c.upload_object(bucket_name="b", file_name="f", obj=b"data")
        c._client.put_object.assert_called_once()

    def test_download_object(self):
        c = self._make_client()
        c._client.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=b"data"))
        }
        result = c.download_object(bucket_name="b", file_name="f")
        assert result == b"data"

    def test_does_prefix_exist_true(self):
        c = self._make_client()
        c._client.list_objects_v2.return_value = {"Contents": [{"Key": "file1"}]}
        assert c.does_prefix_exist(prefix="p", bucket_name="b") is True

    def test_does_prefix_exist_false(self):
        c = self._make_client()
        c._client.list_objects_v2.return_value = {}
        assert c.does_prefix_exist(prefix="p", bucket_name="b") is False

    def test_get_download_presigned_url(self):
        c = self._make_client()
        c._client.generate_presigned_url.return_value = "https://url"
        result = c.get_download_presigned_url(bucket_name="b", file_name="f")
        assert result == "https://url"

    def test_get_upload_presigned_url(self):
        c = self._make_client()
        c._client.generate_presigned_post.return_value = {"url": "https://url"}
        result = c.get_upload_presigned_url(bucket_name="b", file_name="f")
        assert result == {"url": "https://url"}

    def test_get_file_size(self):
        c = self._make_client()
        c._client.head_object.return_value = {"ContentLength": 1024}
        result = c.get_file_size(bucket_name="b", file_name="f")
        assert result == 1024

    def test_download_file(self):
        c = self._make_client()
        c.download_file(bucket_name="b", s3_key="k", file_name="f")
        c._client.download_file.assert_called_once()

    def test_delete_object(self):
        c = self._make_client()
        c.delete_object(bucket_name="b", file_name="f")
        c._client.delete_object.assert_called_once()

    @patch(
        "core.s3_client.SETTINGS",
        MagicMock(S3_TITAN_BUCKET_NAME="bucket", AWS_REGION="us-east-1"),
    )
    def test_check_connection_fail(self):
        c = self._make_client()
        c._client.head_bucket.side_effect = ClientError(
            {"Error": {"Code": "403"}}, "HeadBucket"
        )
        with pytest.raises(S3ClientError):
            c.check_connection()
