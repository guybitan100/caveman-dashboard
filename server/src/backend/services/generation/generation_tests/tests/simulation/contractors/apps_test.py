import pytest
from pytest_mock import MockerFixture

from model.tasks import InstalledAppTask
from metafinder_core.models import AppModel

from generation.simulation.events.contractors.apps import InstalledAppContractor

metafinder_apps_response = [
    {
        "app_id": "com.ape.weather3",
        "name": "APE Weather ( Live Forecast)",
        "os": "android",
        "category": None,
        "event_types": [],
        "icon": None,
    },
    {
        "app_id": "com.apalon.myclockfree",
        "name": "Alarm Clock for Me",
        "os": "both",
        "category": None,
        "event_types": [],
        "icon": "https://play-lh.googleusercontent.com/9GHkT4VypCDcdhblMa6Ds3Bm-EHmT9aCB7hdq2843NrMeCeR3BFV-qSsfxeoIVOHODA=s72-rw",
    },
    {
        "app_id": "com.blushmark.ios",
        "name": "Blush Mark: Women's Clothing",
        "os": "ios",
        "category": None,
        "event_types": [],
        "icon": "https://is5-ssl.mzstatic.com/image/thumb/Purple115/v4/24/b8/44/24b844e8-ff0e-66df-1924-c62216842cfd/source/60x60bb.jpg",
    },
    {
        "app_id": "com.baslas.tubex",
        "name": "Tubex - Videos and Music for YouTube",
        "os": "ios",
        "category": None,
        "event_types": [],
        "icon": None,
    },
    {
        "app_id": "com.verticalbrands.apartmentlist",
        "name": "Apartments & Houses for Rent",
        "os": "ios",
        "category": None,
        "event_types": [],
        "icon": None,
    },
]


def test_construct_five_apps(job: pytest.fixture, mocker: MockerFixture, social_context: pytest.fixture):
    app_count = 5
    task = InstalledAppTask(quantity=app_count)
    get_apps_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_apps_mock.return_value = [AppModel.model_validate(app) for app in metafinder_apps_response]
    apps_contractor = InstalledAppContractor(job=job, task=task)
    apps = list(apps_contractor.construct())
    assert len(apps) == 5
    assert apps[0].app_id == "com.ape.weather3"
    assert apps[1].name == "Alarm Clock for Me"
