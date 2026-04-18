import datetime
from pathlib import Path
from typing import Iterator
from unittest.mock import call

import pytest
from pytest_mock import MockerFixture

from generation.simulation.events.blueprints import ChatBlueprint
from generation.simulation.events.contractors.chats import ChatContractor
from metafinder_core.models import ChatModel
from model.tasks import ChatTask, LocationTask, AudioTask, DocumentTask, VideoTask, ImageTask, ContactTask
from model.types import Entity, EventType, Location, Contact, Image, Video, Document, Audio, GeneratedData, OwnerEntity
from model.utils import str_uuid


chats_blueprints = [
    ChatBlueprint(
        participants=[
            Entity(
                uid="925092ee-61b9-4b41-befe-1ee1c6ccf6ba",
                phone="(425)213-6405x10059",
                first_name="Jacqueline",
                last_name="Cook",
                is_male=None,
                email="rodney80@yahoo.com"
            ),
            Entity(
                uid="ccda1471-1d83-4f58-b417-6fd40b80ac95",
                phone="(132)148-0408x09291",
                first_name=None,
                last_name="Bowman",
                is_male=None,
                email=None
            ),
        ],
        num_messages=1,
        participant_probs=[0.4703345041623964, 0.5296654958376036],
        msg_attachments={},
        num_voice_messages=0
    ),
    ChatBlueprint(
        participants=[
            Entity(
                uid="925092ee-61b9-4b41-befe-1ee1c6ccf6ba",
                phone="(425)213-6405x10059",
                first_name="Jacqueline",
                last_name="Cook",
                is_male=None,
                email="rodney80@yahoo.com"
            ),
            Entity(
                uid="ac57c46e-9948-435c-b160-3eff7103da0b",
                phone="(365)729-8333",
                first_name=None,
                last_name=None,
                is_male=None,
                email="elizabeth35@gregory.org"
            ),
        ],
        num_messages=1,
        participant_probs=[0.6460364691075202, 0.3539635308924798],
        msg_attachments={},
        num_voice_messages=0
    ),
    ChatBlueprint(
        participants=[
            Entity(
                uid="925092ee-61b9-4b41-befe-1ee1c6ccf6ba",
                phone="(425)213-6405x10059",
                first_name="Jacqueline",
                last_name="Cook",
                is_male=None,
                email="rodney80@yahoo.com"
            ),
            Entity(
                uid="ccda1471-1d83-4f58-b417-6fd40b80ac95",
                phone="(132)148-0408x09291",
                first_name=None,
                last_name="Bowman",
                is_male=None,
                email=None
            ),
        ],
        num_messages=1,
        participant_probs=[0.7156067631243525, 0.28439323687564755],
        msg_attachments={},
        num_voice_messages=0,
    ),
    ChatBlueprint(
        participants=[
            Entity(
                uid="925092ee-61b9-4b41-befe-1ee1c6ccf6ba",
                phone="(425)213-6405x10059",
                first_name="Jacqueline",
                last_name="Cook",
                is_male=None,
                email="rodney80@yahoo.com"
            ),
            Entity(
                uid="83de58a7-8d03-46de-9eaa-91d673ae8bee",
                phone=None,
                first_name="Patrick",
                last_name=None,
                is_male=None,
                email="wpope@yahoo.com"
            ),
        ],
        num_messages=1,
        participant_probs=[0.6676240671215343, 0.33237593287846573],
        msg_attachments={},
        num_voice_messages=0,
    ),
    ChatBlueprint(
        participants=[
            Entity(
                uid="925092ee-61b9-4b41-befe-1ee1c6ccf6ba",
                phone="(425)213-6405x10059",
                first_name="Jacqueline",
                last_name="Cook",
                is_male=None,
                email="rodney80@yahoo.com"
            ),
            Entity(
                uid="6f034e7d-7e61-42a4-a7a0-cc256ddcdcc6",
                phone="067.579.9620x2169",
                first_name=None,
                last_name="Cook",
                is_male=None,
                email=None
            ),
        ],
        num_messages=1,
        participant_probs=[0.6540489208264778, 0.3459510791735222],
        msg_attachments={},
        num_voice_messages=0
    )
]

chat_message = ChatModel(text="It's for Formina.", language='en', md5='')

def chat_task_with_attachments(quantity: int) -> ChatTask:
    task_id = str_uuid()
    attachments = [
        AudioTask(
            quantity=1, min_duration=None, max_duration=None, formats=[], categories=[], is_categories_and_op=False
        ),
        DocumentTask(
            quantity=1, min_size=None, max_size=None, formats=[]
        ),
        VideoTask(
            quantity=1, min_duration=None, max_duration=None, formats=[], categories=[], is_categories_and_op=False
        ),
        ImageTask(
            quantity=1, min_width=None, max_width=None, min_height=None, max_height=None, formats=[], categories=[],
            is_categories_and_op=False
        ),
        ContactTask(
            quantity=1, app_id=None
        ),
        LocationTask(
            quantity=1, app_id=None, latitude=34.888649, longitude=32.085053, radius=20
        )
    ]
    for attachment in attachments:
        attachment.parent_task_id = task_id
        attachment.root_task_id = task_id
    task = ChatTask(
        quantity=quantity,
        app_id=None,
        num_chats=None,
        min_num_other_participants=1,
        max_num_other_participants=10000,
        languages=[],
        categories=[],
        is_categories_and_op=False,
        attachments=attachments
    )
    task.task_id = task_id
    return task

chat_blueprints_with_attachments = [ChatBlueprint(participants=[
    OwnerEntity(uid='2c1e47ac-e145-462d-a7a4-345375604504', first_name='Michael', last_name='Wright',
           phone='001-513-150-5446x129', email='brandy64@mcbride.com'),
    Entity(uid='4e3d28cd-77a7-425e-92a1-7e3384c7761e', first_name='David', last_name='Mcknight',
           phone='001-907-145-3406', email='rgrant@gmail.com')],
    num_messages=1, participant_probs=[0.8619631763207674, 0.13803682367923262],
    msg_attachments={}, num_voice_messages=0),
    ChatBlueprint(participants=[OwnerEntity(uid='2c1e47ac-e145-462d-a7a4-345375604504',
                                       first_name='Michael',
                                       last_name='Wright', phone='001-513-150-5446x129',
                                       email='brandy64@mcbride.com'),
                                Entity(uid='4e3d28cd-77a7-425e-92a1-7e3384c7761e',
                                       first_name='David',
                                       last_name='Mcknight', phone='001-907-145-3406',
                                       email='rgrant@gmail.com')], num_messages=1,
                  participant_probs=[0.21484741629756154, 0.7851525837024385],
                  msg_attachments={}, num_voice_messages=0), ChatBlueprint(participants=[
        OwnerEntity(uid='2c1e47ac-e145-462d-a7a4-345375604504', first_name='Michael', last_name='Wright',
               phone='001-513-150-5446x129', email='brandy64@mcbride.com'),
        Entity(uid='4e3d28cd-77a7-425e-92a1-7e3384c7761e', first_name='David', last_name='Mcknight',
               phone='001-907-145-3406', email='rgrant@gmail.com')],
        num_messages=1, participant_probs=[0.09349868075814442, 0.9065013192418556],
        msg_attachments={}, num_voice_messages=0), ChatBlueprint(participants=[
        OwnerEntity(uid='2c1e47ac-e145-462d-a7a4-345375604504', first_name='Michael', last_name='Wright',
               phone='001-513-150-5446x129', email='brandy64@mcbride.com'),
        Entity(uid='4e3d28cd-77a7-425e-92a1-7e3384c7761e', first_name='David', last_name='Mcknight',
               phone='001-907-145-3406', email='rgrant@gmail.com')],
        num_messages=2, participant_probs=[0.0821032544297586, 0.9178967455702414],
        msg_attachments={}, num_voice_messages=0),
]

attachments = {EventType.AUDIO: Audio(uid='71134be1-b1aa-4e30-9887-4d2dbd58367e', format='ogg',
                                      s3_key='audios/d67cfc3c73e49455389e14e9f0f7c097.ogg', data_type='Audio',
                                      filename=None,
                                      path=Path('files/Audio/71134be1-b1aa-4e30-9887-4d2dbd58367e.ogg'),
                                      size=1928300,
                                      is_attachment=True, md5="c7a1f89t11526cf2e1f7d31ab5c04843",
                                      deleted_state='Intact'),
               EventType.DOCUMENT: Document(uid='0eb893b0-023c-401a-932d-e5ae70b6155a', format='docx',
                                            s3_key='files/cc975c682b0ca623e2df95b7ae5a25e2.docx',
                                            data_type='Document', filename=None, path=Path(
                       'files/Document/0eb893b0-023c-401a-932d-e5ae70b6155a.docx'), size=72660, is_attachment=True,
                                            md5="c7a1f89t11526cf2e1h7d31ab5c04843", deleted_state='Intact'),
               EventType.VIDEO: Video(uid='d911ebb4-8091-46a2-9aec-92f76399f444', format='asf',
                                      s3_key='videos/3c5ca3fa24786cebe5d1f13dc494e843.asf', data_type='Video',
                                      filename=None,
                                      path=Path('files/Video/d911ebb4-8091-46a2-9aec-92f76399f444.asf'),
                                      size=13271139,
                                      is_attachment=True, md5="c7a1f89b11536cf2e1f7d31ab5c04843",
                                      deleted_state='Intact'),
               EventType.IMAGE: Image(uid='cb14a5b7-240a-4dd6-a439-c079d9abf7f1', format='bmp',
                                      s3_key='images/6429d1578d78aa84b6c4b0fd1c01b24b.bmp', data_type='Image',
                                      filename=None,
                                      path=Path('files/Image/cb14a5b7-240a-4dd6-a439-c079d9abf7f1.bmp'),
                                      size=644085, is_attachment=True, md5="c7a1f89b11526cf2e1f7d31ab5c04843",
                                      deleted_state='Intact'),
               EventType.CONTACT: Contact(uid='4f961685-d2e6-4ddc-b21e-e5f5447c930c',
                                          time=datetime.datetime(2022, 7, 24, 4, 0, 22), is_sub_event=True,
                                          phones=[('+1-954-425-8724', 'Home')],
                                          first_name='Patrick', last_name='Davis',
                                          emails=[('anthony93@martinez-roberson.com', 'Work')],
                                          is_attachment=True),
               EventType.LOCATION: Location(uid='c604887f-6961-49ef-ad1a-a7c898395250',
                                            time=datetime.datetime(2022, 5, 26, 16, 56, 21), is_sub_event=False,
                                            latitude=34.8459932877698,
                                            longitude=32.11999064850991, is_attachment=True, category='Unknown')}


def read_events_side_effect(job_id: str, event_type: EventType, task_id: str) -> Iterator[GeneratedData]:
    yield from [attachments[event_type]]


def metafinder_get_sentences_side_effect(count: int) -> Iterator[ChatModel]:
    yield from [chat_message] * count


def test_construct_five_chats(job_hub: pytest.fixture, mocker: MockerFixture):
    total_messages = sum(blueprint.num_messages for blueprint in chats_blueprints)
    task = ChatTask(quantity=total_messages)
    read_events_mock = mocker.patch('six_db.events.db.read_events')
    read_events_mock.return_value = []
    get_sentences_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_sentences_mock.side_effect = metafinder_get_sentences_side_effect
    chats_contractor = ChatContractor(hub=job_hub, task=task)
    chats = list(chats_contractor.construct(blueprints=chats_blueprints))

    assert len(chats) == len(chats_blueprints)
    for chat, blueprint in zip(chats, chats_blueprints):
        assert len(chat.messages) == blueprint.num_messages


def test_construct_five_chats_with_attachments_hub_fail(job_hub: pytest.fixture, mocker: MockerFixture):
    total_messages = sum(blueprint.num_messages for blueprint in chat_blueprints_with_attachments)
    task = chat_task_with_attachments(total_messages)
    file_data_mock = mocker.patch("six_db.events.db.read_events")
    file_data_mock.side_effect = read_events_side_effect
    get_sentences_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_sentences_mock.side_effect = metafinder_get_sentences_side_effect
    chats_contractor = ChatContractor(hub=job_hub, task=task)

    with pytest.raises(Exception) as exc_info:
        list(chats_contractor.construct(blueprints=chat_blueprints_with_attachments))


def test_construct_five_chats_with_attachments(job_hub: pytest.fixture, mocker: MockerFixture):
    total_messages = sum(blueprint.num_messages for blueprint in chat_blueprints_with_attachments)
    task = chat_task_with_attachments(total_messages)
    file_data_mock = mocker.patch("six_db.events.db.read_events")
    file_data_mock.side_effect = read_events_side_effect
    get_sentences_mock = mocker.patch("metafinder_core.queries.MetaFinderQueryParams.query")
    get_sentences_mock.side_effect = metafinder_get_sentences_side_effect
    job_hub._completed_task_ids = {att.task_id for att in task.attachments}
    chats_contractor = ChatContractor(hub=job_hub, task=task)
    chats = list(chats_contractor.construct(blueprints=chat_blueprints_with_attachments))

    file_data_calls = [call(job_id=job_hub.job_id, task_id=task.task_id, event_type=task.event_type)
                       for task in task.attachments]

    assert len(chats) == len(chat_blueprints_with_attachments)
    for chat, blueprint in zip(chats, chat_blueprints_with_attachments):
        assert len(chat.messages) == blueprint.num_messages

    file_data_mock.assert_has_calls(file_data_calls)
    attachments_count = sum(len(message.attachments)
                            for chat in chats for message in chat.messages if message.attachments)
    attachments_params_count = sum(task.quantity for task in task.attachments)
    assert attachments_count == attachments_params_count
