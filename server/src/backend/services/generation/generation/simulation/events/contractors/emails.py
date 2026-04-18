from itertools import repeat
from typing import Iterator

from faker import Faker

from generation.simulation.data.generators.crypto import CryptoGenerator
from metafinder_core.queries import TextQueryParams, ChatQueryParams
from model.tasks import EmailTask
from model.types import EventType, Email, FILE_EVENT_TYPES
from generation.simulation.events.blueprints import EmailBlueprint
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times

_faker = Faker()

WEIGHTS_LOC = 10
DEFAULT_ATTACHMENT_PROB = 0.01  # Probability of messages to have attachment(s)


@register_contractor(EventType.EMAIL, dependencies=FILE_EVENT_TYPES)
class EmailsContractor(EventContractor[EmailTask, Email]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.crypto_generator = CryptoGenerator()

    def construct(self, blueprints: Iterator[EmailBlueprint]) -> Iterator[Email]:
        num_characters = self._random_range_choices(self.quantity,
                                                    self.task.min_characters, self.task.max_characters)
        subjects = ChatQueryParams(languages=self.job.context.languages).query(count=self.quantity)
        texts = TextQueryParams().query(self.quantity)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        attachments_iter = self._get_attachments(attachments_params=self.task.attachments,
                                                 attachments_prob=DEFAULT_ATTACHMENT_PROB,
                                                 event_dependencies=FILE_EVENT_TYPES)

        folder_options = ['Inbox']   # Inbox is a permanent option
        random_folders_count = self.task.max_folder_amount - 2   # 2 because Sent Items is also permanent
        if random_folders_count > 0:
            folder_options += [word.capitalize() for word in _faker.words(random_folders_count)]
        folders = self._random_choices(self.quantity, folder_options)

        if self.task.add_crypto_artifacts:
            has_crypto_artifacts = self._random_boolean_choices(n=self.quantity, true_prob=self.task.crypto_prob)
        else:
            has_crypto_artifacts = repeat(False, times=self.quantity)

        emails = (
            Email(
                subject=subject.text,
                body=(text.text if not has_crypto_artifact else self.crypto_generator.enrich_string(text.text))[:max_characters],
                from_entity=blueprint.from_entity.uid,
                to_entities=[entity.uid for entity in blueprint.to_entities],
                folder=folder if blueprint.from_entity.uid != self.context.owner_entity.uid else 'Sent Items',
                attachments=attachments,
                time=time,
                location_id=location_id
            )
            for blueprint, subject, text, max_characters, attachments, folder, time, location_id, has_crypto_artifact
            in zip(blueprints, subjects, texts, num_characters, attachments_iter, folders, times, location_ids, has_crypto_artifacts)
        )

        yield from emails
