from core.s3_client import SixS3Client


class MockS3Client(SixS3Client):

    def __init__(self):
        pass

    def get_file_size(self, *args, **kwargs) -> int:
        return 5

    def does_prefix_exist(self, *args, **kwargs) -> bool:
        return True

    def download_file(self, *args, **kwargs):
        pass

    def get_download_presigned_url(self, *args, **kwargs) -> str:
        return 'fqwerqw'

    def upload_file(self, *args, **kwargs):
        pass
