from model.tasks import ChatTask, GenerationTask, UploadedFileTask
from model.types import EventType

CHATS_TASK = ChatTask(quantity=15)

CHATS_TASK_WITH_APPS = ChatTask(
    quantity=15,
    app_id="com.telcel.contenedor"
)

UPLOAD_FILE_TASK_IMAGE = UploadedFileTask(
    event_type=EventType.IMAGE,
    file_name='test.jpeg', md5='fbf927d834e2a1182ea89ab6702f58fb', file_size=256
)
