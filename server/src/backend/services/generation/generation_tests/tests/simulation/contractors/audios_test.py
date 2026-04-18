import pytest
from pytest_mock import MockerFixture

from model.tasks import AudioTask
from metafinder_core.models import AudioModel

from generation.simulation.events.contractors.audios import AudioContractor

metafinder_audios_response = [
    {
        "md5": "ac1efb99817fdcd670fdad14bcfdf948",
        "filename": None,
        "categories": ["Music"],
        "duration": 36,
        "s3_key": "audios\\ac1efb99817fdcd670fdad14bcfdf948.webm",
        "size": 672317,
        "presigned_url": None,
        "format": "mp3",
    },
    {
        "md5": "51dcc7d062a6fafd6689f3927e9258ad",
        "filename": None,
        "categories": ["Music"],
        "duration": 224,
        "s3_key": "audios\\51dcc7d062a6fafd6689f3927e9258ad.webm",
        "size": 3940035,
        "presigned_url": None,
        "format": "ogg",
    },
    {
        "md5": "10bd1e51d475933c6f3dbdb3ea5dc50e",
        "filename": None,
        "categories": ["Speech"],
        "duration": 4,
        "s3_key": "audios\\10bd1e51d475933c6f3dbdb3ea5dc50e.wav",
        "size": 139566,
        "presigned_url": None,
        "format": "aac",
    },
    {
        "md5": "80ccb1989df813feaf13925a3afcf1b2",
        "filename": None,
        "categories": [],
        "duration": 120,
        "s3_key": "audios\\80ccb1989df813feaf13925a3afcf1b2.m4a",
        "size": 1943606,
        "presigned_url": None,
        "format": "wma",
    },
    {
        "md5": "8a0a2dd5ac94d00734f66ca5a0f5504a",
        "filename": None,
        "categories": ["Vehicle", "Explosion", "Music"],
        "duration": 59,
        "s3_key": "audios\\8a0a2dd5ac94d00734f66ca5a0f5504a.m4a",
        "size": 962313,
        "presigned_url": None,
        "format": "aif",
    },
]


def test_construct_five_audios(
        job: pytest.fixture,
        job_hub: pytest.fixture,
        mocker: MockerFixture
):
    audios_count = 5
    task = AudioTask(quantity=audios_count)
    get_audios_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_audios_mock.return_value = [AudioModel.model_validate(audio) for audio in metafinder_audios_response]
    audios_contractor = AudioContractor(job=job, hub=job_hub, task=task)
    audios = audios_contractor.construct()
    assert len(list(audios)) == 5
