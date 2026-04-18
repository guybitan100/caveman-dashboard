from model.tasks import ChatTask, AudioTask
from model.types import EventType


audio_task = AudioTask(quantity=2)
audio_task.task_id = '53ab0eb4-894d-4604-b554-4b7f68e5b96b'
audio_task.parent_task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
audio_task.root_task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
chat_task_with_attachments = ChatTask(
	quantity=15,
    attachments=[audio_task]
)
chat_task_with_attachments.task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
chat_task_with_attachments.parent_task_id = None
chat_task_with_attachments.root_task_id = None


audio_task = AudioTask(quantity=2)
audio_task.task_id = '53ab0eb4-894d-4604-b554-4b7f68e5b96b'
audio_task.parent_task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
audio_task.root_task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
chat_task_with_voice_messages = ChatTask(
	quantity=15,
    voice_messages_quantity=2,
    voice_messages_task=audio_task
)
chat_task_with_voice_messages.task_id = '18b7b259-96d2-4c48-8888-c13ffaae08a6'
chat_task_with_voice_messages.parent_task_id = None
chat_task_with_voice_messages.root_task_id = None


def test_get_sub_tasks_of_attachments():
	sub_tasks = list(chat_task_with_attachments.get_sub_tasks())
	assert len(sub_tasks) == 1
	assert sub_tasks[0].task_id == '53ab0eb4-894d-4604-b554-4b7f68e5b96b'
	assert sub_tasks[0].event_type is EventType.AUDIO
	assert sub_tasks[0].quantity == 2


def test_get_sub_tasks_of_voice_messages():
	sub_tasks = list(chat_task_with_voice_messages.get_sub_tasks())
	assert len(sub_tasks) == 1
	assert sub_tasks[0].task_id == '53ab0eb4-894d-4604-b554-4b7f68e5b96b'
	assert sub_tasks[0].event_type is EventType.AUDIO
	assert sub_tasks[0].quantity == 2
