import unittest
from pathlib import Path

import boto3
from moto import mock_aws

from core.config import SETTINGS
from generation.conversion.converter_utils import FileDataDownloader
from model.types import Image


@mock_aws
class FileDataDownloaderTestCase(unittest.TestCase):

    def setUp(self):
        self.client = boto3.client('s3')
        self.client.create_bucket(Bucket=SETTINGS.S3_SIX_BUCKET_NAME)
        self.file_datas = [
            Image(
                uid="1",
                s3_bucket="test_bucket",
                s3_key="test_key.jpg",
                size=1024,
                md5='abcdef0123456789abcdef0123456789',
                format='jpg',
                deleted_state='Intact'
            ),
            Image(
                uid="2",
                s3_bucket="test_bucket",
                s3_key="test_key.jpg",
                size=1024,
                md5='abcdef0123456789abcdef0123456789',
                format='jpg',
                deleted_state='Intact'
            )
        ]
        self.dir_path = Path("/tmp/test")
        self.max_workers = 2
        self.downloader = FileDataDownloader(
            file_datas=self.file_datas,
            dir_path=self.dir_path,
            max_workers=self.max_workers
        )

    def test_worker_instantiation(self):
        self.assertEqual(len(self.downloader._workers), self.max_workers)

    def test_quota_reservation(self):
        self.assertEqual(self.downloader._quota._size_total, 0)
        self.downloader._quota.reserve(1024)
        self.assertEqual(self.downloader._quota._size_total, 1024)

    def test_stop_worker(self):
        self.downloader._workers[0].stop()
        self.assertTrue(self.downloader._workers[0]._stop_event.is_set())



