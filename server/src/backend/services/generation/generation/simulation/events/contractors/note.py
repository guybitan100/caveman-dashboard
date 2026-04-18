from itertools import repeat
from typing import Iterator

from generation.simulation.data.generators.crypto import CryptoGenerator
from metafinder_core.queries import ChatQueryParams
from model.metafinder.queries import ArrayQuery, QueryOperator
from model.tasks import NoteTask
from model.types import Note, EventType
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times


@register_contractor(EventType.NOTE)
class NoteContractor(EventContractor[NoteTask, Note]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.crypto_generator = CryptoGenerator()

    def construct(self) -> Iterator[Note]:
        bodies = self._get_sentences()
        titles = self._get_sentences()
        last_modifies = random_times(n=self.quantity, job=self.job)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)
        if self.task.add_crypto_artifacts:
            has_crypto_artifacts = self._random_boolean_choices(n=self.quantity, true_prob=self.task.crypto_prob)
        else:
            has_crypto_artifacts = repeat(False, times=self.quantity)

        notes = (
            Note(
                title=title,
                body=body if not has_crypto_artifact else self.crypto_generator.enrich_string(body),
                last_modified=last_modified,
                time=time,
                location_id=location_id
            )
            for body, title, last_modified, time, location_id, has_crypto_artifact
            in zip(bodies, titles, last_modifies, times, location_ids, has_crypto_artifacts)
        )

        yield from notes

    def _get_sentences(self) -> Iterator[str]:
        languages = self.task.languages or self.job.context.languages
        for sentence in ChatQueryParams(
                languages=languages,
                categories=ArrayQuery(
                    operator=QueryOperator.AND if self.task.is_categories_and_op else QueryOperator.OR,
                    values=self.task.categories
                )
        ).query(count=self.quantity):
            split_text = sentence.text.split()
            if len(split_text) > self.task.max_words:
                yield ' '.join(split_text[:self.task.max_words])
            else:
                yield sentence.text
