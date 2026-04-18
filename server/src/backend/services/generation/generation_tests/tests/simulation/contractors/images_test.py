import pytest
from pytest_mock import MockerFixture

from model.tasks import ImageTask
from metafinder_core.models import ImageModel

from generation.simulation.events.contractors.images import ImageContractor

metafinder_images_response = [
    {
        "path": None,
        "s3_key": "images\\1410130aa441f0eaf164cd8ab9327aec.jpeg",
        "width": 296,
        "height": 170,
        "format": "bmp",
        "md5": "1410130aa441f0eaf164cd8ab9327aec",
        "size": 11021,
        "categories": ["Smartphones", "Documents"],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "images\\f3cea91d368ea8b52575a5e34489102c.jpeg",
        "width": 1024,
        "height": 681,
        "format": "jpeg",
        "md5": "f3cea91d368ea8b52575a5e34489102c",
        "size": 548789,
        "categories": ["Gatherings", "Face"],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "images\\49c27ea9293f343b520539c12fadcc4d.jpeg",
        "width": 1080,
        "height": 1349,
        "format": "gif",
        "md5": "49c27ea9293f343b520539c12fadcc4d",
        "size": 128127,
        "categories": ["Hand_Holding_Objects", "FireExplosion", "Nudity", "Tattoos"],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "images\\9b9c5baf7958dfe08f4d304a79df0aa7.jpeg",
        "width": 560,
        "height": 1024,
        "format": "webp",
        "md5": "9b9c5baf7958dfe08f4d304a79df0aa7",
        "size": 139314,
        "categories": ["Tattoos"],
        "presigned_url": None,
    },
    {
        "path": None,
        "s3_key": "images\\d4ad586b83e1c05fcd875fe19f31b3bc.jpeg",
        "width": 495,
        "height": 640,
        "format": "png",
        "md5": "d4ad586b83e1c05fcd875fe19f31b3bc",
        "size": 111399,
        "categories": ["Beach", "Documents"],
        "presigned_url": None,
    },
]


def test_construct_five_images(
        job: pytest.fixture,
        job_hub: pytest.fixture,
        mocker: MockerFixture
):
    images_count = 5
    task = ImageTask(quantity=images_count)
    get_images_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_images_mock.return_value = [ImageModel.model_validate(img) for img in metafinder_images_response]
    images_contractor = ImageContractor(job=job, hub=job_hub, task=task)
    images = images_contractor.construct()
    assert len(list(images)) == 5
