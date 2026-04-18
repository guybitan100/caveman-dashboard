import os
import unittest
from pathlib import Path

from core.config import get_env_dotenv_file
from core.config import ROOT_PATH

class TestGetEnvDotenvFile(unittest.TestCase):

    def setUp(self) -> None:
        os.environ['SIX_ENV'] = 'default'

    def test_env_dotenv_file(self):
        self.assertEqual(get_env_dotenv_file(), str(Path(ROOT_PATH, '.env')))

    def test_get_env_dotenv_file_type(self):
        self.assertIsInstance(get_env_dotenv_file(), str)
