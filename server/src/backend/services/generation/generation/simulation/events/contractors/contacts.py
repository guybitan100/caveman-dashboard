import itertools
import random
from typing import Iterator

import numpy as np

from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.tasks import ContactTask
from model.types import Contact, EventType, Entity
from simulation_utils.entities import generate_entities
from simulation_utils.info import PersonalInfoGenerator

_PHONE_CATEGORIES = ['Home', 'Work', 'Mobile', 'Other']
_EMAIL_CATEGORIES = ['Home', 'Work', 'Other']

# Probability that, when task is a sub-task (attachment), the Contact will be created from a new entity (not in SocialContext)
_NEW_ENTITY_PROBABILITY = 0.5

_SHARED_ENTITY_PROBABILITY = 0.02   # Probability that multiple contacts share identifiers


@register_contractor(EventType.CONTACT)
class ContactsContractor(EventContractor[ContactTask, Contact]):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._personal_info_generator = PersonalInfoGenerator(country_info=self.job.context.country_info)

    def construct(self) -> Iterator[Contact]:
        if not self.task.is_sub_task:
            entities = self.context.get_random_entities(n=self.quantity, unique=True)
        else:
            num_new_entities = np.random.binomial(n=self.quantity, p=_NEW_ENTITY_PROBABILITY)
            entities = self.context.get_random_entities(n=self.quantity - num_new_entities, unique=True)

        # This statements will be true in any of the following 2 conditions:
        # - task is not sub task and therefore less entities than task quantity are retrieved from social context
        # - task quantity > social.py:MAX_ENTITIES (e.g. >100,000) (due to calculations of social context entity totals)
        if len(entities) < self.quantity:
            new_entities = generate_entities(n=self.quantity - len(entities),
                                             country_info=self.job.context.country_info)
            entities.extend(new_entities)

        locations_ids = self.hub.get_task_location_ids(task=self.task)

        # Determine what contacts have shared identifiers (we do this by duplicating/overwriting entity)
        self._determine_shared_identifiers_and_rearrange_entities(entities)

        # Determine amount of phone number entries per contact
        num_phones = self._random_range_choices(self.quantity,
                                                self.task.min_phone_numbers, self.task.max_phone_numbers)
        # Iterator provides capability for generation of max possible phone categories, but will likely halt early
        phone_categories = self._random_choices(self.quantity * self.task.max_phone_numbers, _PHONE_CATEGORIES)

        # Determine amount of email address entries per contact
        num_emails = self._random_range_choices(self.quantity,
                                                self.task.min_email_addresses, self.task.max_email_addresses)
        # Iterator provides capability for generation of max possible email categories, but will likely halt early
        email_categories = self._random_choices(self.quantity * self.task.max_email_addresses, _EMAIL_CATEGORIES)

        times = random_times(n=len(entities), job=self.job)
        contacts = (
            Contact(
                phones=self._get_phone_entries(entity=entity, entry_amount=n_phones, categories=phone_categories),
                first_name=entity.first_name,
                last_name=entity.last_name,
                emails=self._get_email_entries(entity=entity, entry_amount=n_emails, categories=email_categories),
                time=time,
                is_sub_event=self.task.is_sub_task,
                is_nested_data=self.task.is_sub_task,
                location_id=location_id
            )
            for entity, n_phones, n_emails, time, location_id
            in zip(entities, num_phones, num_emails, times, locations_ids)
        )

        yield from contacts

    def _get_phone_entries(self, entity: Entity, entry_amount: int, categories: Iterator[str])\
            -> list[Contact.ContactEntry]:
        if not entry_amount:    # No phone numbers as per user configuration
            return []

        # Initialize with entity's default entry
        entries = [Contact.ContactEntry(value=entity.phone, category=next(categories))]

        # Additional phone number entries
        total_extra_phones = entry_amount - 1   # -1 to exclude entity's default entry
        extra_categories = itertools.islice(categories, 0, total_extra_phones)
        extra_phones = self._personal_info_generator.generate_phone_numbers(n=total_extra_phones)
        extra_entries = [
            Contact.ContactEntry(value=phone, category=category)
            for phone, category in zip(extra_phones, extra_categories)
        ]
        entries.extend(extra_entries)

        return entries

    def _get_email_entries(self, entity: Entity, entry_amount: int, categories: Iterator[str])\
            -> list[Contact.ContactEntry]:

        if not entry_amount:    # No email addresses as per user configuration
            return []

        # Initialize with entity's default entry
        entries = [Contact.ContactEntry(value=entity.email, category=next(categories))]

        # Additional email entries
        total_extra_emails = entry_amount - 1   # -1 to exclude entity's default entry
        extra_categories = itertools.islice(categories, 0, total_extra_emails)  # -1 to exclude entity's default entry
        extra_emails = self._personal_info_generator.generate_emails(n=total_extra_emails)
        extra_entries = [
            Contact.ContactEntry(value=email, category=category)
            for email, category in zip(extra_emails, extra_categories)
        ]
        entries.extend(extra_entries)

        return entries

    @staticmethod
    def _determine_shared_identifiers_and_rearrange_entities(entities: list[Entity]) -> None:
        if len(entities) < 2:  # there can not possibly be 2 entities with shared identifiers in this case
            return

        shared_entity_idxs = list(np.flatnonzero(np.random.binomial(n=True, p=_SHARED_ENTITY_PROBABILITY, size=len(entities))))
        if len(shared_entity_idxs) < 2:  # there can not possibly be 2 entities with shared identifiers in this case
            return

        random.shuffle(shared_entity_idxs)   # Randomly shuffle indices to account for mixing shared (attached) contacts

        # Randomly select number of clusters of shared entities.
        #   Maximum num clusters is half of length of shared entities (each size of 2)
        num_shared_clusters = random.randint(1, len(shared_entity_idxs) // 2)

        # Initialize base entity idxs (clusters) to groups of 2 and then append (if needed) random base entity idxs
        #  using random weights. This will be length len(shared_entity_idxs) at the end. The base entities will replace
        #  the others with the same base entity idx in the original list of entities.
        #   Example: num_shared_clusters=3 --> cluster_ids=[0, 0, 1, 1, 2, 2] + [<random cluster indices>]
        cluster_ids = [i for i in range(num_shared_clusters) for _ in range(2)]
        if len(cluster_ids) < len(shared_entity_idxs):
            cluster_ids += random.choices(range(num_shared_clusters),
                                          k=len(shared_entity_idxs)-len(cluster_ids),
                                          weights=[random.random() for _ in range(num_shared_clusters)])

        # Replace entities in original list with entity from shared_entity_idxs[base_entity_idx]
        source_entities = {}    # Dynamically updated dict of cluster_id->cluster's source entity (to be duplicated)
        for cluster_id, entity_idx in zip(cluster_ids, shared_entity_idxs):
            source_entity = source_entities.setdefault(cluster_id, entities[entity_idx])
            entities[entity_idx] = source_entity
