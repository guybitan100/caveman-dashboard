from io import BytesIO


def mock_smart_open():
    class MockSmartOpen(object):
        def __init__(self, *args, **kwargs):
            self.stream = BytesIO()

        def __enter__(self):
            return self.stream

        def __exit__(self, type, value, traceback):
            pass

        def read_data(self):
            self.stream.seek(0)
            return self.stream.read()

        def write_data(self, data: bytes):
            self.stream.write(data)
            self.stream.seek(0)

    return MockSmartOpen()
