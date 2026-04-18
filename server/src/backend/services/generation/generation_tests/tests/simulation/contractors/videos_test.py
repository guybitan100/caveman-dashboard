import pytest
from pytest_mock import MockerFixture

from model.tasks import VideoTask
from metafinder_core.models import VideoModel

from generation.simulation.events.contractors.videos import VideoContractor

metafinder_videos_response = [
    {
        "path": None,
        "s3_key": "videos\\cf4d17377b2e99b0641ab9c9dc3a8adf.mp4",
        "duration": 87000,
        "format": "mpeg",
        "md5": "cf4d17377b2e99b0641ab9c9dc3a8adf",
        "size": 4957833,
        "categories": [
            "Smartphones",
            "Money",
            "Hand_Holding_Objects",
            "BarcodesQRCodes",
            "Documents",
            "Jewelry",
            "Face",
            "Tattoos",
            "Cigarettes",
            "Photo_Id",
        ],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "videos\\667d968379538d3c49b197d827c0c986.mp4",
        "duration": 78000,
        "format": "mp4",
        "md5": "667d968379538d3c49b197d827c0c986",
        "size": 9111302,
        "categories": [
            "Smartphones",
            "Money",
            "Restaurant",
            "Hand_Holding_Objects",
            "Documents",
            "Nudity",
            "Jewelry",
            "Flags",
            "Face",
            "Upskirt",
        ],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "videos\\d4fe1ed2311e7c9612c015f799dae901.mp4",
        "duration": 202000,
        "format": "m4v",
        "md5": "d4fe1ed2311e7c9612c015f799dae901",
        "size": 6802542,
        "categories": [
            "Screenshots",
            "BarcodesQRCodes",
            "Documents",
            "Handwritten",
            "Jewelry",
            "Credit_Cards",
        ],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "videos\\d7da116532b65aa7036249ed9dc90b3c.mp4",
        "duration": 77,
        "format": "wmv",
        "md5": "d7da116532b65aa7036249ed9dc90b3c",
        "size": 12718536,
        "categories": [
            "Drugs",
            "Hand_Holding_Objects",
            "Handwritten",
            "Nudity",
            "Jewelry",
            "Cigarettes",
            "Upskirt",
            "Smartphones",
            "Maps",
            "Weapons",
            "Documents",
            "Vehicle_Dashboards",
            "Camera",
            "Face",
            "Food",
        ],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "videos\\106f962ab8a9b7f85f03dd79a4f74b68.mp4",
        "duration": 61000,
        "format": "mts",
        "md5": "106f962ab8a9b7f85f03dd79a4f74b68",
        "size": 3452355,
        "categories": [
            "Cars",
            "Drugs",
            "Hand_Holding_Objects",
            "BarcodesQRCodes",
            "Handwritten",
            "Jewelry",
            "Invoices",
            "Tattoos",
            "Cigarettes",
            "Credit_Cards",
            "Smartphones",
            "Beach",
            "Maps",
            "Documents",
            "Face",
        ],
        "presigned_url": None,
    },
]


def test_construct_five_videos(
        job: pytest.fixture,
        job_hub: pytest.fixture,
        mocker: MockerFixture
):
    videos_count = 5
    task = VideoTask(quantity=videos_count,)
    get_videos_patch = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_videos_patch.return_value = [VideoModel.model_validate(vid) for vid in metafinder_videos_response]
    videos_contractor = VideoContractor(job=job, hub=job_hub, task=task)
    videos = videos_contractor.construct()
    assert len(list(videos)) == 5
