import ssl
import itertools
from itertools import repeat
import random
from datetime import datetime, timedelta
from enum import Enum
from typing import Iterator

from faker import Faker
import geopy
from geopy.exc import GeocoderUnavailable, GeocoderServiceError

from metafinder_core.queries import ChatQueryParams
from metafinder_core.models import ChatModel
from model.metafinder.queries import ArrayQuery, QueryOperator
from model.tasks import CalendarEntryTask
from model.types import EventType, CalendarEntry, GeneratedData, Location, FILE_EVENT_TYPES
from generation.simulation.utils import random_times
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor

SUBJECT_PROB = 0.9
DETAILS_PROB = 0.4
REMINDERS_PROB = 0.2
ATTACHMENTS_PROB = 0.1
ATTENDEES_PROB = 0.4
POSITION_PROB = 0.3
LOCATION_PROB = 0.4
MAX_EVENT_DURATION = 10080  # In minutes. 60 * 24 * 7
MAX_INTERVAL_VALUE = 5
CALENDAR_ENTRY_DEPENDENCIES = {*FILE_EVENT_TYPES, EventType.LOCATION}


class CalendarEventAvailability(Enum):
    UNKNOWN = 'Unknown'
    FREE = 'Free'
    TENTATIVE = 'Tentative'
    BUSY = 'Busy'
    OUT_OF_OFFICE = 'OutOfOffice'
    WORKING_ELSEWHERE = 'WorkingElsewhere'


class CalendarEventClass(Enum):
    NORMAL = 'Normal'
    PERSONAL = 'Personal'
    PRIVATE = 'Private'
    CONFIDENTIAL = 'Confidential'
    PUBLIC = 'Public'


class CalendarEventPriority(Enum):
    UNKNOWN = 'Unknown'
    LOW = 'Low'
    NORMAL = 'Normal'
    HIGH = 'High'


class CalendarEventStatus(Enum):
    UNKNOWN = 'Unknown'
    ACCEPTED = 'Accepted'
    NEEDS_ACTION = 'NeedsAction'
    SENT = 'Sent'
    TENTATIVE = 'Tentative'
    CONFIRMED = 'Confirmed'
    DECLINED = 'Declined'
    COMPLETED = 'Completed'
    DELEGATED = 'Delegated'
    IN_PROGRESS = 'InProgress'
    WAITING_ON_INFO = 'WaitingOnInfo'
    CANCELLED = 'Cancelled'


class CalendarEventType(Enum):
    MEETING = 'Meeting'
    BIRTHDAY = 'Birthday'
    ANNIVERSARY = 'Anniversary'
    PHONE_CALL = 'PhoneCall'
    TASK = 'Task'
    REMINDER = 'Reminder'
    MEMO = 'Memo'
    NOTE = 'Note'


class CalendarRepeatDay(Enum):
    NONE = 0x00
    Sunday = 0x01
    Monday = 0x02
    Tuesday = 0x04
    Wednesday = 0x08
    Thursday = 0x10
    Friday = 0x20
    Saturday = 0x40
    First = 0x80
    Second = 0x100
    Third = 0x200
    Fourth = 0x400
    Last = 0x800


class CalendarRepeatRule(Enum):
    NONE = 'None'
    DAILY = 'Daily'
    WEEKLY = 'Weekly'
    MONTHLY = 'Monthly'
    YEARLY = 'Yearly'


_faker = Faker()
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE
_geolocator = geopy.Nominatim(user_agent='Titan', ssl_context=ssl_ctx)


@register_contractor(EventType.CALENDAR_ENTRY, dependencies=CALENDAR_ENTRY_DEPENDENCIES)
class CalenderEntryContractor(EventContractor[CalendarEntryTask, CalendarEntry]):
    def construct(self) -> Iterator[CalendarEntry]:
        times = random_times(n=self.quantity, job=self.job)
        positions = self.hub.get_task_locations(task=self.task)
        attachments_iter = self._get_attachments(attachments_params=self.task.attachments,
                                                 attachments_prob=ATTACHMENTS_PROB,
                                                 event_dependencies=FILE_EVENT_TYPES)

        availabilities = self._random_enum_choices(self.quantity, CalendarEventAvailability, none_weight=0.5)
        statuses = self._random_enum_choices(self.quantity, CalendarEventStatus, none_weight=0.5)
        repeat_rules = self._random_enum_choices(self.quantity, CalendarRepeatRule, none_weight=0.5)
        repeat_days = self._random_enum_choices(self.quantity, CalendarRepeatDay, none_weight=0.5)
        classes = self._random_enum_choices(self.quantity, CalendarEventClass, none_weight=0.5)

        details_lens = list(self._random_range_choices(self.quantity, 1, self.task.max_details_sentences, none_weight=DETAILS_PROB))
        reminder_lens = self._random_range_choices(self.quantity, 1, self.task.max_reminders, none_weight=REMINDERS_PROB)
        attendees_lens = self._random_range_choices(self.quantity, 1, self.task.max_attendees, none_weight=ATTENDEES_PROB)

        has_subjects = list(self._random_boolean_choices(self.quantity, true_prob=SUBJECT_PROB))
        has_locations = self._random_boolean_choices(self.quantity, true_prob=LOCATION_PROB)

        if self.task.events_categories:
            categories = self._random_choices(self.quantity, self.task.events_categories)
        else:
            categories = repeat(None, times=self.quantity)

        subjects = map(self._get_sentence, self._get_sentences(sum(has_subjects)))
        details = (s.text for s in self._get_sentences(sum(filter(None, details_lens))))

        calendar_entries = (
            self._construct_calendar_entry(
                times=times,
                attachments=attachments,
                subjects=subjects,
                details=details,
                has_subject=has_subject,
                category=category,
                details_length=details_length,
                num_reminders=num_reminders,
                repeat_rule=repeat_rule,
                repeat_day=repeat_day,
                availability=availability,
                num_attendees=num_attendees,
                status=status,
                event_position=event_position,
                has_location=has_location,
                event_class=event_class)
            for has_subject, category, details_length, num_reminders, attachments, repeat_rule,repeat_day,
                availability, num_attendees, status, event_position, has_location, event_class
            in zip(has_subjects, categories, details_lens, reminder_lens, attachments_iter, repeat_rules, repeat_days,
                   availabilities, attendees_lens, statuses, positions, has_locations, classes)
        )

        yield from calendar_entries

    def _construct_calendar_entry(self,
                                  times: Iterator[datetime],
                                  attachments: tuple[GeneratedData],
                                  subjects: Iterator[str],
                                  details: Iterator[str],
                                  event_position: Location | None,
                                  has_location: bool,
                                  has_subject: bool,
                                  category: str,
                                  details_length: int,
                                  num_reminders: int,
                                  repeat_rule: CalendarRepeatRule | None,
                                  repeat_day: CalendarRepeatDay | None,
                                  availability: CalendarEventAvailability | None,
                                  num_attendees: int,
                                  status: CalendarEventStatus | None,
                                  event_class: CalendarEventClass | None) -> CalendarEntry:

        start_date = next(times)
        event_delta = random.randint(1, MAX_EVENT_DURATION)
        end_date = start_date + timedelta(minutes=event_delta)
        event_location = None
        from_entity = None
        to_entities = None
        if event_position and has_location:
            event_location = self._get_geo_location(location=event_position)
        elif has_location:
            event_location = _faker.address()
        if num_attendees:
            random_entities = self.context.get_random_entities(num_attendees, unique=True) + [self.context.owner_entity]
            from_entity = random_entities.pop(random.randrange(len(random_entities))).uid
            to_entities = [e.uid for e in random_entities]

        return CalendarEntry(
            subject=next(subjects) if has_subject else None,
            category=category,
            details='\n'.join(itertools.islice(details, details_length)) if details_length else None,
            reminders=list(random_times(n=num_reminders, job=self.job)) if num_reminders else None,
            start_date=start_date,
            end_date=end_date,
            attachments=attachments,
            repeat_rule=repeat_rule.value if repeat_rule else None,
            repeat_day=repeat_day.value if repeat_day else None,
            repeat_interval=random.randrange(MAX_INTERVAL_VALUE) if repeat_rule and repeat_day else None,
            availability=availability.value if availability else None,
            location_id=event_position.uid if event_position else None,
            coordinate=self._create_coordinate_from_location(event_position),
            from_entity=from_entity,
            to_entities=to_entities,
            status=status.value if status else None,
            event_class=event_class.value if event_class else None,
            location=event_location
        )

    def _get_sentences(self, n: int) -> Iterator[ChatModel]:
        languages = self.task.languages or self.job.context.languages
        yield from ChatQueryParams(
            languages=languages,
            categories=ArrayQuery(
                operator=QueryOperator.AND if self.task.is_categories_and_op else QueryOperator.OR,
                values=self.task.categories
            )
        ).query(count=n)

    def _get_sentence(self, sentence: ChatModel) -> str:
        max_length = self.task.max_subject_words
        split_text = sentence.text.split(' ')
        if len(split_text) > max_length:
            return ' '.join(split_text[:max_length])
        else:
            return sentence.text

    def _get_geo_location(self, location: Location) -> str | None:
        try:
            lang = random.choice(self.job.context.languages) if self.job.context.languages else False
            address = None
            geo_location = _geolocator.reverse(f'{location.latitude}, {location.longitude}', language=lang)
            if geo_location:
                address = geo_location.address
            return address
        except (GeocoderUnavailable, GeocoderServiceError, Exception):
            return None
