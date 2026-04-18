import pytest

from metafinder_core.models import TextModel, ChatModel
from pytest_mock import MockerFixture
from model.tasks import EmailTask
from model.types import Entity

from generation.simulation.events.blueprints import EmailBlueprint
from generation.simulation.events.contractors.emails import EmailsContractor

email_blueprints = [
    EmailBlueprint(
        from_entity=Entity(
            uid="506d40c5-2bcd-4ab7-a76e-a184cf59a0c1",
            phone="889-411-0457x0128",
            first_name=None,
            last_name=None,
            gender=None,
            email="wheelerjason@lindsey-bradshaw.com",
        ),
        to_entities=[
            Entity(
                uid="506d40c5-2bcd-4ab7-a76e-a184cf59a0c1",
                phone="889-411-0457x0128",
                first_name=None,
                last_name=None,
                gender=None,
                email="wheelerjason@lindsey-bradshaw.com",
            ),
            Entity(
                uid="c97f5dfe-463b-47d3-aeab-078403a62122",
                phone="(782)341-1125",
                first_name=None,
                last_name="Rivera",
                gender="",
                email="gonzalezjill@russell.com",
            ),
            Entity(
                uid="ad32cf3e-d17f-4ed9-9c1c-1384ba0316a5",
                phone="985-987-5906",
                first_name="Terri",
                last_name="Miller",
                gender="",
                email="uibarra@garrett.com",
            ),
        ],
    ),
    EmailBlueprint(
        from_entity=Entity(
            uid="ad32cf3e-d17f-4ed9-9c1c-1384ba0316a5",
            phone="985-987-5906",
            first_name="Terri",
            last_name="Miller",
            gender="",
            email="uibarra@garrett.com",
        ),
        to_entities=[
            Entity(
                uid="506d40c5-2bcd-4ab7-a76e-a184cf59a0c1",
                phone="889-411-0457x0128",
                first_name=None,
                last_name=None,
                gender=None,
                email="wheelerjason@lindsey-bradshaw.com",
            ),
            Entity(
                uid="c97f5dfe-463b-47d3-aeab-078403a62122",
                phone="(782)341-1125",
                first_name=None,
                last_name="Rivera",
                gender="",
                email="gonzalezjill@russell.com",
            ),
        ],
    ),
    EmailBlueprint(
        from_entity=Entity(
            uid="c97f5dfe-463b-47d3-aeab-078403a62122",
            phone="(782)341-1125",
            first_name=None,
            last_name="Rivera",
            gender="",
            email="gonzalezjill@russell.com",
        ),
        to_entities=[
            Entity(
                uid="c97f5dfe-463b-47d3-aeab-078403a62122",
                phone="(782)341-1125",
                first_name=None,
                last_name="Rivera",
                gender="",
                email="gonzalezjill@russell.com",
            ),
            Entity(
                uid="506d40c5-2bcd-4ab7-a76e-a184cf59a0c1",
                phone="889-411-0457x0128",
                first_name=None,
                last_name=None,
                gender=None,
                email="wheelerjason@lindsey-bradshaw.com",
            ),
            Entity(
                uid="ad32cf3e-d17f-4ed9-9c1c-1384ba0316a5",
                phone="985-987-5906",
                first_name="Terri",
                last_name="Miller",
                gender="",
                email="uibarra@garrett.com",
            ),
        ],
    ),
    EmailBlueprint(
        from_entity=Entity(
            uid="c97f5dfe-463b-47d3-aeab-078403a62122",
            phone="(782)341-1125",
            first_name=None,
            last_name="Rivera",
            gender="",
            email="gonzalezjill@russell.com",
        ),
        to_entities=[
            Entity(
                uid="ad32cf3e-d17f-4ed9-9c1c-1384ba0316a5",
                phone="985-987-5906",
                first_name="Terri",
                last_name="Miller",
                gender="",
                email="uibarra@garrett.com",
            )
        ],
    ),
    EmailBlueprint(
        from_entity=Entity(
            uid="c97f5dfe-463b-47d3-aeab-078403a62122",
            phone="(782)341-1125",
            first_name=None,
            last_name="Rivera",
            gender="",
            email="gonzalezjill@russell.com",
        ),
        to_entities=[
            Entity(
                uid="ad32cf3e-d17f-4ed9-9c1c-1384ba0316a5",
                phone="985-987-5906",
                first_name="Terri",
                last_name="Miller",
                gender="",
                email="uibarra@garrett.com",
            )
        ],
    ),
]


def test_construct_five_emails(job: pytest.fixture, job_hub: pytest.fixture, mocker: MockerFixture):
    task = EmailTask(quantity=len(email_blueprints))
    metafinder_client_get_text_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    metafinder_client_get_sentences_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    mocker.patch('titan_db.events.db.read_events')
    metafinder_client_get_text_mock.return_value = [
        TextModel(
            text="template string for testing",
            size=len("template string for testing"),
            md5="",
        ),
        TextModel(
            text="template string for testing",
            size=len("template string for testing"),
            md5="",
        ),
        TextModel(
            text="template string for testing",
            size=len("template string for testing"),
            md5="",
        ),
        TextModel(
            text="template string for testing",
            size=len("template string for testing"),
            md5="",
        ),
        TextModel(
            text="template string for testing",
            size=len("template string for testing"),
            md5="",
        ),
    ]
    metafinder_client_get_sentences_mock.return_value = [
        ChatModel(text='subject 1', language='en', md5=""),
        ChatModel(text='subject 2', language='en', md5=""),
        ChatModel(text='subject 3', language='en', md5=""),
        ChatModel(text='subject 4', language='en', md5=""),
        ChatModel(text='subject 5', language='en', md5="")
    ]
    emails_contractor = EmailsContractor(job=job, hub=job_hub, task=task)
    emails = emails_contractor.construct(blueprints=email_blueprints)
    assert len(list(emails)) == 5
