from uuid import uuid4

from core.config import SETTINGS
from core.s3_client import SixS3Client
from model.job import GenerationJob
from model.tasks import UploadedFileTask
from model.stories import ChatMessageStoryData, _ChatStoryData, ChatStoryData, FILE_STORY_TYPES, StoryFileTypes, \
    StoryDataAdapter, FileStoryData
from model.types import Entity
from model.uploads import UploadedMessage, UploadedChatStory, UploadedData, UploadedStoryResult
from model.utils import deserialize


def _get_entity_name(entity: Entity) -> str:
    name_values = []
    if entity.first_name:
        name_values.append(entity.first_name)
    if entity.last_name:
        name_values.append(entity.last_name)
    return " ".join(name_values)


def _convert_messages(
        uploaded_messages: list[UploadedMessage],
        entities_name_to_uid: dict[str, str],
        chat_uid: str
) -> list[ChatMessageStoryData]:
    return [
        ChatMessageStoryData(
            sender=entities_name_to_uid[uploaded_message.sender_id],
            text=uploaded_message.text,
            status=uploaded_message.status,
            forwarded=uploaded_message.forwarded,
            time=uploaded_message.time,
            chat_uid=chat_uid,
        )
        for uploaded_message in uploaded_messages
    ]


def handle_uploaded_chat(uploaded_chat: UploadedChatStory) -> dict:
    entities_name_to_uid = {_get_entity_name(e): e.uid for e in uploaded_chat.participants}
    chat_uid = str(uuid4())
    chat = _ChatStoryData(
        participants=[e.uid for e in uploaded_chat.participants],
        messages=_convert_messages(
            uploaded_messages=uploaded_chat.messages,
            entities_name_to_uid=entities_name_to_uid,
            chat_uid=chat_uid
        ),
    )
    chat_data = ChatStoryData(
        chat=chat,
        uid=chat_uid,
    )
    return UploadedStoryResult(
        entities=uploaded_chat.participants,
        story=chat_data,
    ).model_dump(exclude_none=True)


def convert_uploaded_data(uploaded_data: UploadedData) -> dict:
    if isinstance(uploaded_data, UploadedChatStory):
        return handle_uploaded_chat(uploaded_chat=uploaded_data)
    raise ValueError(f"Unsupported uploaded data type: {type(uploaded_data)}")


def verify_uploaded_files_exist_or_fail(job: GenerationJob) -> None:
    s3_client = SixS3Client()

    missing_task_upload_msgs = []
    for root_task in job.tasks:
        for task in root_task.flatten_tasks():
            if isinstance(task, UploadedFileTask):
                if not s3_client.does_prefix_exist(
                        prefix=f'{SETTINGS.S3_BUCKET_UPLOADS_PREFIX}/{task.md5}',
                        bucket_name=SETTINGS.S3_SIX_BUCKET_NAME
                ):
                    missing_task_upload_msgs.append(
                        f'- [Task] Key/MD5={task.md5}, Filename={task.file_name}, Size={task.file_size}')

    missing_story_upload_msgs = []
    for story_id, story_data in job.stories.nodes.data('data'):
        story = deserialize(story_data, StoryDataAdapter)
        if isinstance(story, FileStoryData) \
                and story.file.file_type is StoryFileTypes.UPLOAD \
                and not s3_client.does_prefix_exist(prefix=f'{SETTINGS.S3_BUCKET_UPLOADS_PREFIX}/{story.file.s3_key}',
                                                    bucket_name=SETTINGS.S3_SIX_BUCKET_NAME):
            missing_story_upload_msgs.append(
                f'- [Story] Key/MD5={story.file.s3_key}, Filename={story.file.file_name}, Size={story.file.size}')

    missing_upload_msgs = '\n'.join(missing_story_upload_msgs + missing_task_upload_msgs)
    if missing_upload_msgs:
        raise KeyError(
            f"Some of the job's referenced uploaded files no longer exist in the S3 upload bucket:\n"
            f"{missing_upload_msgs}")
