import mimetypes
from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Callable, ClassVar
from pathlib import PureWindowsPath

from model.types import PhoneCall, ChatMessage, Chat, InstalledApplication, Email, CarvedString, Note, Notification, \
    Journey, FileData, EventData, Location, Cookie, WebBookmark, WebHistory, Password, Contact, Archive, \
    GeneratedData, Audio, Document, Image, Video, CalendarEntry, CreditCard, RecognizedDevice, UserAccount, \
    PoweringEvent, CellTower, EventType, FinancialAccount
from model.utils import str_uuid
from generation.conversion.serializer_context import SerializerContext
from generation.conversion.serializer_utils import formulate_entity_name, Field, StrField, TimeField, Int32Field, \
    create_coordinate_model_field, convert_coordinate_to_deg_min_sec
from generation.conversion.report import Event, EventModelField, EventMultiModelField, File, Metadata, Item, \
    AccessInfo, EventDataField, EventDataFieldValue, EventMultiField, EventFieldValue, Timestamp, TargetId, JumpTargets


class BaseReportSerializer(ABC):
    @classmethod
    def _add_base_jump_targets(cls, context: SerializerContext, model: File | Event) -> None:
        if model.id in context.jump_targets:
            event_jump_targets = context.jump_targets[model.id]
            target_ids = [
                TargetId(value=jt_id, is_model=issubclass(jt_event_data_type, EventData))
                for jt_id, jt_event_data_type in event_jump_targets
            ]
            jump_targets = JumpTargets(target_ids=target_ids)
            model.jump_targets = jump_targets

    @classmethod
    def register_base_jump_targets[GD: GeneratedData](cls, context: SerializerContext, data: GD) -> None:
        if data.location_id:
            context.register_jump_targets(data, data.location_id, Location)

    @classmethod
    def register_jump_targets[GD: GeneratedData](cls, context: SerializerContext, data: GD) -> None:
        pass


class ReportModelSerializer[ED: EventData](BaseReportSerializer, ABC):
    model_type: ClassVar[str]   # Initialized on class registration

    @classmethod
    def serialize_event(cls, context: SerializerContext, event: ED, **serialize_kwargs) -> Event:
        model = cls.serialize(context, event, **serialize_kwargs)
        cls._add_source_application(context=context, event=event, model=model)
        cls._add_jump_targets(context=context, model=model)
        return model

    @classmethod
    def _add_source_application(cls, context: SerializerContext, event: EventData, model: Event) -> None:
        app_name = context.app_uid_to_name.get(event.app_uid)
        if app_name is not None:  # Generated event was assigned to an app
            model.fields.append(StrField(name="Source", value=app_name))  # Add app field to report model

    @classmethod
    def _add_jump_targets(cls, context: SerializerContext, model: Event) -> None:
        if model.id in context.jump_targets:
            cls._add_base_jump_targets(context=context, model=model)
            # Recursion for model's sub-models
            for model_field in model.model_fields:
                cls._add_jump_targets(context, model_field.event)
            for multi_model_field in model.multi_model_fields:
                if multi_model_field.events:
                    for multi_model_event in multi_model_field.events:
                        cls._add_jump_targets(context, multi_model_event)

    @classmethod
    @abstractmethod
    def serialize(cls, context: SerializerContext, event: ED, **kwargs) -> Event:
        raise NotImplementedError

    @classmethod
    def register_base_jump_targets(cls, context: SerializerContext, event: ED) -> None:
        super().register_base_jump_targets(context=context, data=event)
        if event.app_uid in context.app_uid_to_name:
            context.register_jump_targets(event, event.app_uid, InstalledApplication)


class ReportAttachmentSerializer(ABC):
    @classmethod
    @abstractmethod
    def serialize(cls, context: SerializerContext, event: GeneratedData) -> Event:
        raise NotImplementedError


_event_serializer_registry: dict[EventType, type[ReportModelSerializer]] = {}
_attachment_serializer_registry: dict[type[GeneratedData], type[ReportAttachmentSerializer]] = {}
event_type_to_model_type: dict[str, str] = {}


def event_serializer(
        event_type: EventType,
        model_type: str
) -> Callable[[type[ReportModelSerializer]], type[ReportModelSerializer]]:
    """
    Decorator method that globally registers a ReportModelSerializer class to an event type
    """

    def _register(serializer_class: type[ReportModelSerializer]) -> type[ReportModelSerializer]:
        if event_type in _event_serializer_registry:
            raise Exception(f'Cannot register multiple serializers to the same event type ({event_type})')
        if model_type in event_type_to_model_type.values():
            raise Exception(f'Cannot register multiple serializers with the same report model type ({event_type})')
        serializer_class.model_type = model_type
        _event_serializer_registry[event_type] = serializer_class
        event_type_to_model_type[event_type] = model_type
        return serializer_class

    return _register


def attachment_serializer(
        event_types: set[type[GeneratedData]]
) -> Callable[[type[ReportAttachmentSerializer]], type[ReportAttachmentSerializer]]:
    """
    Decorator method that globally registers a ReportAttachmentSerializer class to GeneratedData types
    """

    def _register(serializer_class: type[ReportAttachmentSerializer]) -> type[ReportAttachmentSerializer]:
        for event_type in event_types:
            if event_type in _attachment_serializer_registry:
                raise Exception(
                    f"Cannot register multiple serializers to the same attachment data type ({event_type.__name__})")
            _attachment_serializer_registry[event_type] = serializer_class
        return serializer_class

    return _register


class SerializerNotFoundError(Exception):
    def __init__(self, event_type: str):
        super().__init__(f'Event serializer for "{event_type}" not found')


def get_serializer(event_type: EventType) -> type[ReportModelSerializer]:
    serializer = _event_serializer_registry.get(event_type)
    if serializer is None:
        raise SerializerNotFoundError(event_type=event_type)
    return serializer


def get_attachment_serializer(event_type: type[GeneratedData]) -> type[ReportAttachmentSerializer]:
    serializer = _attachment_serializer_registry.get(event_type)
    if serializer is None:
        raise SerializerNotFoundError(event_type=event_type.__name__)
    return serializer


class ReportFileSerializer(BaseReportSerializer):
    @classmethod
    def serialize(cls, context: SerializerContext, file_data: FileData) -> File:
        timestamps = []
        metadata_items = [
            Item(name="File size", value=f'{file_data.size} Bytes')
        ]
        if file_data.time is not None:
            time_str = file_data.time.isoformat()
            # Access info
            timestamps = [
                Timestamp(name="CreationTime", value=time_str),
                Timestamp(name="ModifyTime", value=time_str),
                Timestamp(name="AccessTime", value=time_str)
            ]
            # "MetaData" metadata
            metadata_items.extend([
                Item(name="Creation time", value=time_str),
                Item(name="Modify time", value=time_str),
                Item(name="Last access time", value=time_str),
                Item(name="CoreFileSystemFileSystemNodeCreationTime", value=time_str,
                     group="CoreFileSystemFileSystemNodeDateTime"),
                Item(name="CoreFileSystemFileSystemNodeModifyTime", value=time_str,
                     group="CoreFileSystemFileSystemNodeDateTime"),
                Item(name="CoreFileSystemFileSystemNodeLastAccessTime", value=time_str,
                     group="CoreFileSystemFileSystemNodeDateTime")
            ])
            if file_data.deleted_state == 'Deleted':
                metadata_items.extend([
                    Item(name="CoreFileSystemFileSystemNodeDeletedTime", value=time_str,
                         group="CoreFileSystemFileSystemNodeDateTime"),
                    Item(name="CoreFileSystemFileSystemNodeChangeTime", value=time_str,
                         group="CoreFileSystemFileSystemNodeDateTime"),
                ])

        if file_data.coordinate:
            lon_degree = convert_coordinate_to_deg_min_sec(coord=file_data.coordinate.lon)
            lat_degree = convert_coordinate_to_deg_min_sec(coord=file_data.coordinate.lat)
            lon_ref = 'E' if file_data.coordinate.lon > 0 else 'W'
            lat_ref = 'N' if file_data.coordinate.lat > 0 else 'S'
            metadata_items.extend(
                [
                    Item(
                        name="MetaDataLatitudeAndLongitude",
                        value=f'{file_data.coordinate.lat} / {file_data.coordinate.lon}',
                        group="File Metadata"
                    ),
                    Item(
                        name="ExifEnumGPSLatitudeRef",
                        value=lat_ref,
                        group="EXIF"
                    ),
                    Item(
                        name="ExifEnumGPSLatitude",
                        value=f'{lat_degree[0]}, {lat_degree[1]}, {lat_degree[2]}',
                        group="EXIF"
                    ),
                    Item(
                        name="ExifEnumGPSLongitudeRef",
                        value=lon_ref,
                        group="EXIF"
                    ),
                    Item(
                        name="ExifEnumGPSLongitude",
                        value=f'{lon_degree[0]}, {lon_degree[1]}, {lon_degree[2]}',
                        group="EXIF"
                    )
                ]
            )

        access_info = AccessInfo(timestamps=timestamps)
        metadata = Metadata(section="MetaData", items=metadata_items)

        # "File" metadata
        metadata_file = Metadata(
            section="File",
            items=[
                Item(name="Local Path", value=str(PureWindowsPath(file_data.path))),
                Item(name="MD5", value=file_data.md5),
                Item(name="Tags", value=file_data.data_type)
            ]
        )

        tagged_file = File(
            fs="Titan file system",
            fsid="00000000-0000-0000-0000-000000000001",
            path=str(file_data.path),
            size=file_data.size or 0,
            id=file_data.uid,
            deleted=file_data.deleted_state,
            source_index=context.source_index,
            access_info=access_info,
            metadata_file=metadata_file,
            metadata=metadata
        )

        cls._add_base_jump_targets(context=context, model=tagged_file)

        return tagged_file


@event_serializer(event_type=EventType.LOCATION, model_type='Location')
class LocationSerializer(ReportModelSerializer[Location]):
    @classmethod
    def serialize(cls, context: SerializerContext, location: Location, **kwargs) -> Event:
        coordinate_model_field = create_coordinate_model_field(
            name="Position", latitude=location.latitude, longitude=location.longitude
        )
        category = StrField(name='Category', value=location.category)
        timestamp = TimeField(value=location.time)
        location_model = Event(
            type="Location",
            id=location.uid,
            source_index=context.source_index,
            model_fields=[coordinate_model_field],
            fields=[category, timestamp]
        )
        return location_model

    @classmethod
    def register_jump_targets(cls, context: SerializerContext, location: Location) -> None:
        if location.thumbnail:
            context.register_jump_targets(parent_event=location, child_event=location.thumbnail)


@event_serializer(event_type=EventType.COOKIE, model_type='Cookie')
class CookieSerializer(ReportModelSerializer[Cookie]):
    @classmethod
    def serialize(cls, context: SerializerContext, cookie: Cookie, **kwargs) -> Event:
        name = StrField(name="Name", value=cookie.name)
        value = StrField(name="Value", value=cookie.value)
        domain = StrField(name="Domain", value=cookie.domain)
        cookie_model = Event(
            type="Cookie",
            id=cookie.uid,
            source_index=context.source_index,
            fields=[name, value, domain]
        )
        return cookie_model


@event_serializer(event_type=EventType.FINANCIAL_ACCOUNT, model_type='FinancialAccount')
class FinancialAccountSerializer(ReportModelSerializer[FinancialAccount]):
    @classmethod
    def serialize(cls, context: SerializerContext, account: FinancialAccount, **kwargs) -> Event:
        account_id = StrField(name="AccountID", value=account.account_id)
        account_type = StrField(name="FinancialAccountType", value=account.account_type)
        assets = EventMultiModelField(
            type="Asset",
            name="Assets",
            events=[
                Event(id=str_uuid(), type="Asset", fields=[StrField(name="Currency", value=asset)])
                for asset in account.assets
            ]
        )
        account_model = Event(
            id=account.uid,
            type="FinancialAccount",
            fields=[account_id, account_type],
            multi_model_fields=[assets]
        )
        return account_model


@event_serializer(event_type=EventType.WEB_BOOKMARK, model_type='WebBookmark')
class WebBookmarkSerializer(ReportModelSerializer[WebBookmark]):
    @classmethod
    def serialize(cls, context: SerializerContext, bookmark: WebBookmark, **kwargs) -> Event:
        title = StrField(name="Title", value=bookmark.title)
        url = StrField(name="Url", value=bookmark.url)
        visit_count = Int32Field(name="VisitCount", value=bookmark.uses)
        path = StrField(name="Path", value=bookmark.folder)
        timestamp = TimeField(value=bookmark.time)
        bookmark_model = Event(
            type="WebBookmark",
            id=bookmark.uid,
            source_index=context.source_index,
            fields=[title, url, visit_count, path, timestamp]
        )
        return bookmark_model


@event_serializer(event_type=EventType.WEB_HISTORY, model_type='VisitedPage')
class WebHistorySerializer(ReportModelSerializer[WebHistory]):
    @classmethod
    def serialize(cls, context: SerializerContext, history: WebHistory, **kwargs) -> Event:
        title = StrField(name="Title", value=history.title)
        url = StrField(name="Url", value=history.url)
        timestamp = TimeField(name="LastVisited", value=history.time)
        visit_count = Int32Field(name="VisitCount", value=history.uses)
        history_model = Event(
            type="VisitedPage",
            id=history.uid,
            source_index=context.source_index,
            fields=[title, url, timestamp, visit_count]
        )
        return history_model


@event_serializer(event_type=EventType.PASSWORD, model_type='Password')
class PasswordSerializer(ReportModelSerializer[Password]):
    @classmethod
    def serialize(cls, context: SerializerContext, password: Password, **kwargs) -> Event:
        account = StrField(name="Account", value=password.account)
        data = StrField(name="Data", value=password.data)
        password_model = Event(
            type="Password",
            id=password.uid,
            source_index=context.source_index,
            fields=[account, data]
        )
        return password_model


@event_serializer(event_type=EventType.CONTACT, model_type='Contact')
class ContactSerializer(ReportModelSerializer[Contact]):
    @classmethod
    def serialize(cls, context: SerializerContext, contact: Contact, **kwargs) -> Event:
        name = StrField(
            name="Name",
            value=" ".join([contact.first_name or "", contact.last_name or ""]).strip() or None,
        )

        emails = cls._serialize_contact_entries(
            context=context, entries=contact.emails, type_='EmailAddress', domain='Email')
        phones = cls._serialize_contact_entries(
            context=context, entries=contact.phones, type_='PhoneNumber', domain='Phone')
        entries = EventMultiModelField(name="Entries", type="ContactEntry", events=emails + phones)
        contact_model = Event(
            type="Contact",
            id=contact.uid,
            source_index=context.source_index,
            fields=[name],
            multi_model_fields=[entries]
        )
        return contact_model

    @classmethod
    def _serialize_contact_entries(
            cls,
            context: SerializerContext,
            entries: list[Contact.ContactEntry],
            type_: str,
            domain: str
    ) -> list[Event]:
        return [
            Event(
                type=type_,
                id=str_uuid(),
                source_index=context.source_index,
                fields=[
                    StrField(name="Category", value=entry.category),
                    StrField(name="Value", value=entry.value),
                    StrField(name="Domain", value=domain)
                ]
            )
            for entry in entries
        ]


@event_serializer(event_type=EventType.APP, model_type='InstalledApplication')
class InstalledAppSerializer(ReportModelSerializer[InstalledApplication]):
    @classmethod
    def serialize(cls, context: SerializerContext, app: InstalledApplication, **kwargs) -> Event:
        name = StrField(name="Name", value=app.name)
        identifier = StrField(name="Identifier", value=app.app_id)
        app_model = Event(
            type="InstalledApplication",
            id=app.uid,
            source_index=context.source_index,
            fields=[name, identifier]
        )
        return app_model


@event_serializer(event_type=EventType.CALL, model_type='Call')
class CallSerializer(ReportModelSerializer[PhoneCall]):
    @classmethod
    def serialize(cls, context: SerializerContext, call: PhoneCall, **kwargs) -> Event:
        direction = Field(name="Direction", type="ModelDirections", value=call.direction)
        call_type = Field(name="Type", type="CallType", value=call.call_type)
        timestamp = TimeField(value=call.time)
        duration = Field(
            name="Duration",
            type="TimeSpan",
            value=call.duration,
            func=lambda d: str(timedelta(seconds=d))
        )

        # Parties
        party_entity = context.social_context[call.participant]
        party_name = StrField(name="Name", value=formulate_entity_name(party_entity))  # TODO isInferred?
        party_identifier = StrField(name="Identifier", value=party_entity.phone)
        party_role = Field(
            name="Role",
            type="PartyRole",
            value="To" if call.direction == "Outgoing" else "From"
        )
        party_status = Field(name="Status", type="PartyStatus", value="Unknown")
        party_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=party_entity.is_owner)
        party = Event(
            type="Party",
            id=party_entity.uid,
            source_index=context.source_index,
            fields=[party_identifier, party_role, party_status, party_name, party_is_owner]
        )

        parties = EventMultiModelField(name="Parties", type="Party", events=[party])
        call_model = Event(
            type="Call",
            id=call.uid,
            source_index=context.source_index,
            fields=[direction, call_type, timestamp, duration],
            multi_model_fields=[parties]
        )
        return call_model


@event_serializer(event_type=EventType.INSTANT_MESSAGE, model_type='InstantMessage')
class ChatMessageSerializer(ReportModelSerializer[ChatMessage]):
    @classmethod
    def serialize(
            cls,
            context: SerializerContext,
            message: ChatMessage,
            chat: Chat = None,  # Indicates inner Chat message, passed by ChatSerializer
            **kwargs,
    ) -> Event:
        multi_model_fields = []
        """ NOTE: commenting out to reduce size of report.xml
        to_parties = EventMultiModelField(name='To', type='Party',
                                          events=list(participants.values()))
        multi_model_fields.append(to_parties)
        """
        from_entity = context.social_context[message.sender]
        from_party_name = StrField(name="Name", value=formulate_entity_name(from_entity))
        from_party_identifier = StrField(name="Identifier", value=from_entity.phone)
        from_party_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=from_entity.is_owner)
        from_party_model = Event(
            type="Party",
            id=from_entity.uid,
            source_index=context.source_index,
            fields=[from_party_name, from_party_identifier, from_party_is_owner]
        )
        from_party = EventModelField(name="From", type="Party", event=from_party_model)
        body = None
        if message.text:
            body = StrField(name="Body", value=message.text)
        timestamp = TimeField(value=message.time)
        message_type_value = 'AppMessage' if chat is not None else 'Mms' if message.attachments else 'Sms'
        message_type = Field(name="Type", type="InstantMessageType", value=message_type_value)
        platform = Field(name="Platform", type="Platform", value="Mobile")
        status = Field(name="Status", type="MessageStatus", value=message.status)
        identifier = StrField(name="Identifier", value=message.uid.upper().replace("-", ""))

        # Message extra data
        message_extra_data_models = []
        if message.reply_msg_uid is not None:
            reply_label = Field(name="Label", type="Label", value="Reply")
            original_message_id = StrField(
                name="OriginalMessageID",
                value=message.reply_msg_uid.upper().replace("-", ""),
            )
            reply_message_data = Event(
                type="ReplyMessageData",
                id=str_uuid(),
                source_index=context.source_index,
                fields=[reply_label, original_message_id]
            )
            message_extra_data_models.append(reply_message_data)
        if message.forwarded:
            forwarded_label = Field(name="Label", type="Label", value="Forwarded")
            forwarded_message_data = Event(
                type="ForwardedMessageData",
                id=str_uuid(),
                source_index=context.source_index,
                fields=[forwarded_label]
            )
            message_extra_data_models.append(forwarded_message_data)
        if message_extra_data_models:
            message_extra_data = EventMultiModelField(
                name="MessageExtraData",
                type="InstantMessageExtraData",
                events=message_extra_data_models,
            )
            multi_model_fields.append(message_extra_data)

        # Attachments
        attachment_models = []
        shared_contact_models = []
        position_field = None
        if message.attachments:
            for attachment in message.attachments:
                attachment_type = type(attachment)
                attach_serializer = get_attachment_serializer(attachment_type)
                attachment_model = attach_serializer.serialize(context, attachment)

                if attachment_type is Location:
                    position_field = create_coordinate_model_field(name="Position", latitude=attachment.latitude,
                                                                   longitude=attachment.longitude)

                if attachment_type is Contact:
                    shared_contact_models.append(attachment_model)
                elif attachment_model is not None:  # LocationAttachmentSerializer can theoretically return None
                    attachment_models.append(attachment_model)

        attachments = EventMultiModelField(name="Attachments", type="Attachment", events=attachment_models)
        multi_model_fields.append(attachments)
        shared_contacts = EventMultiModelField(name="SharedContacts", type="Contact", events=shared_contact_models)
        multi_model_fields.append(shared_contacts)

        if message.coordinate:
            position_field = create_coordinate_model_field(
                name="Position", latitude=message.coordinate.lat, longitude=message.coordinate.lon
            )

        fields = [timestamp, platform, message_type, status, identifier]
        if body:
            fields.append(body)
        model_fields = [from_party]
        if position_field:
            model_fields.append(position_field)
        message_model = Event(
            type="InstantMessage",
            id=message.uid,
            source_index=context.source_index,
            fields=fields,
            model_fields=model_fields,
            multi_model_fields=multi_model_fields
        )
        if chat is not None:  # ChatMessage is part of Chat event, add Chat event's app_id to message
            cls._add_source_application(context=context, event=chat, model=message_model)
        return message_model

    @classmethod
    def register_jump_targets(cls, context: SerializerContext, message: ChatMessage) -> None:
        if message.attachments:
            for attachment in message.attachments:
                # Shared contacts may not always have a corresponding Contact entry in the model type
                if type(attachment) != Contact or not attachment.is_sub_event:
                    context.register_jump_targets(message, attachment)

        if message.location_id:
            context.register_jump_targets(message, message.location_id, Location)


@event_serializer(event_type=EventType.CHAT, model_type='Chat')
class ChatSerializer(ReportModelSerializer[Chat]):
    @classmethod
    def serialize(
            cls,
            context: SerializerContext,
            chat: Chat,
            skip_messages: bool = False,
            **kwargs,
    ) -> Event:
        id_ = StrField(name="Id", value=chat.uid)
        fields = [id_]

        # Participants
        participant_models = {}
        for participant_id in chat.participants:
            party_entity = context.social_context[participant_id]
            party_name = StrField(name="Name", value=formulate_entity_name(party_entity))
            party_identifier = StrField(name="Identifier", value=party_entity.phone)
            party_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=party_entity.is_owner)
            participant_model = Event(
                type="Party",
                id=party_entity.uid,
                source_index=context.source_index,
                fields=[party_name, party_identifier, party_is_owner]
            )
            participant_models[party_entity.uid] = participant_model
        participants = EventMultiModelField(name="Participants", type="Party", events=list(participant_models.values()))

        multi_model_fields = [participants]

        # Messages
        if not skip_messages:   # Messages are not serialized as part of Chat event, but injected by the converter
            message_models = [
                ChatMessageSerializer.serialize(context, message, chat=chat) for message in chat.messages
            ]
            messages = EventMultiModelField(name="Messages", type="InstantMessage", events=message_models)
            multi_model_fields.append(messages)

        chat_model = Event(
            type="Chat",
            id=chat.uid,
            source_index=context.source_index,
            fields=fields,
            multi_model_fields=multi_model_fields
        )
        return chat_model

    @classmethod
    def _add_jump_targets(cls, context: SerializerContext, model: Event) -> None:
        message_mmf = next((mmf for mmf in model.multi_model_fields if mmf.name == 'Messages'), None)
        if message_mmf is not None:   # no messages, this will be None if serialize() was called with skip_messages=True
            for message_event in message_mmf.events:
                super()._add_jump_targets(context, message_event)


@event_serializer(event_type=EventType.EMAIL, model_type='Email')
class EmailSerializer(ReportModelSerializer[Email]):
    @classmethod
    def serialize(cls, context: SerializerContext, email: Email, **kwargs) -> Event:
        multi_model_fields = []
        folder = StrField(name="Folder", value=email.folder)
        account = StrField(name="Account", value=context.social_context.owner_entity.email)

        # From party
        from_entity = context.social_context[email.from_entity]
        from_identifier = StrField(name="Identifier", value=from_entity.email)
        from_role = Field(name="Role", type="PartyRole", value="From")
        from_name = StrField(name="Name", value=formulate_entity_name(from_entity))
        from_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=from_entity.is_owner)
        from_ = EventModelField(
            name="From",
            type="Party",
            event=Event(
                type="Party",
                id=from_entity.uid,
                source_index=context.source_index,
                fields=[from_identifier, from_role, from_name, from_is_owner]
            ),
        )

        # To parties
        to_parties = []
        for entity_id in email.to_entities:
            to_entity = context.social_context[entity_id]
            to_identifier = StrField(name="Identifier", value=to_entity.email)
            to_role = Field(name="Role", type="PartyRole", value="To")
            to_name = StrField(name="Name", value=formulate_entity_name(to_entity))
            to_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=to_entity.is_owner)
            to_party = Event(
                type="Party",
                id=to_entity.uid,
                source_index=context.source_index,
                fields=[to_identifier, to_role, to_name, to_is_owner]
            )
            to_parties.append(to_party)
        to = EventMultiModelField(name="To", type="Party", events=to_parties)
        multi_model_fields.append(to)

        subject = StrField(name="Subject", value=email.subject)
        body = StrField(name="Body", value=email.body)
        timestamp = TimeField(value=email.time)

        # Attachments
        attachment_models = []
        if email.attachments:
            for attachment in email.attachments:
                attach_serializer = get_attachment_serializer(type(attachment))
                attachment_model = attach_serializer.serialize(context, attachment)
                attachment_models.append(attachment_model)

        attachments = EventMultiModelField(name="Attachments", type="Attachment", events=attachment_models)
        multi_model_fields.append(attachments)

        email_model = Event(
            type="Email",
            id=email.uid,
            source_index=context.source_index,
            fields=[folder, subject, body, timestamp, account],
            model_fields=[from_],
            multi_model_fields=multi_model_fields
        )
        return email_model

    @classmethod
    def register_jump_targets(cls, context: SerializerContext, email: Email) -> None:
        if email.attachments:
            for attachment in email.attachments:
                if not attachment.is_sub_event:
                    context.register_jump_targets(email, attachment)


@event_serializer(event_type=EventType.CARVED_STRING, model_type='CarvedString')
class CarvedStringSerializer(ReportModelSerializer[CarvedString]):
    @classmethod
    def serialize(cls, context: SerializerContext, carved_string: CarvedString, **kwargs) -> Event:
        value = StrField(name="Value", value=f"text: {carved_string.body}")
        carved_string_model = Event(
            type="CarvedString",
            id=carved_string.uid,
            source_index=context.source_index,
            fields=[value]
        )
        return carved_string_model


@event_serializer(event_type=EventType.NOTE, model_type='Note')
class NoteSerializer(ReportModelSerializer[Note]):
    @classmethod
    def serialize(cls, context: SerializerContext, note: Note, **kwargs) -> Event:
        title = StrField(name="Title", value=note.title)
        body = StrField(name="Body", value=note.body)
        modified = TimeField(name="Modification", value=note.last_modified)
        note_model = Event(
            type="Note",
            id=note.uid,
            source_index=context.source_index,
            fields=[title, body, modified]
        )
        return note_model


@event_serializer(event_type=EventType.NOTIFICATION, model_type='Notification')
class NotificationSerializer(ReportModelSerializer[Notification]):
    @classmethod
    def serialize(cls, context: SerializerContext, notification: Notification, **kwargs) -> Event:
        body = StrField(name="Body", value=notification.body)
        timestamp = TimeField(value=notification.time)
        urls = EventMultiModelField(name="Urls", type="WebAddress")  # (weird) Necessary field for PF to display
        notification_model = Event(
            type="Notification",
            id=notification.uid,
            source_index=context.source_index,
            fields=[body, timestamp],
            multi_model_fields=[urls]
        )
        return notification_model


@event_serializer(event_type=EventType.JOURNEY, model_type='Journey')
class JourneySerializer(ReportModelSerializer[Journey]):
    @classmethod
    def serialize(cls, context: SerializerContext, journey: Journey, **kwargs) -> Event:
        start_time = TimeField(name="StartTime", value=journey.start_time)
        end_time = TimeField(name="EndTime", value=journey.end_time)
        from_coordinate_model_field = create_coordinate_model_field(
            name="FromPoint", latitude=journey.from_lat, longitude=journey.from_long)
        to_coordinate_model_field = create_coordinate_model_field(
            name="ToPoint", latitude=journey.to_lat, longitude=journey.to_long)
        journey_model = Event(
            type="Journey",
            id=journey.uid,
            source_index=context.source_index,
            fields=[start_time, end_time],
            model_fields=[from_coordinate_model_field, to_coordinate_model_field]
        )
        return journey_model


@event_serializer(event_type=EventType.CREDIT_CARD, model_type='CreditCard')
class CreditCardSerializer(ReportModelSerializer[CreditCard]):
    @classmethod
    def serialize(cls, context: SerializerContext, credit_card: CreditCard, **kwargs) -> Event:
        name_on_card = StrField(name="NameOnCard", value=credit_card.owner_name)
        card_number = StrField(name="CreditCardNumber", value=credit_card.number)
        expiration_date = TimeField(name="ExpirationDate", value=credit_card.expiration_date)
        last_used_date = TimeField(name="DateLastUsed", value=credit_card.last_used_date)
        card_company = Field(name='Company', type='CreditCardCompany', value=credit_card.company)
        credit_card_model = Event(
            type="CreditCard",
            id=credit_card.uid,
            source_index=context.source_index,
            fields=[name_on_card, card_number, expiration_date, last_used_date, card_company]
        )
        return credit_card_model


@event_serializer(event_type=EventType.CALENDAR_ENTRY, model_type='CalendarEntry')
class CalendarEntrySerializer(ReportModelSerializer[CalendarEntry]):
    @classmethod
    def serialize(cls, context: SerializerContext, calendar_entry: CalendarEntry, **kwargs) -> Event:
        multi_fields = []
        model_fields = []
        multi_model_fields = []

        start_time = TimeField(name="StartDate", value=calendar_entry.start_date)
        end_time = TimeField(name="EndDate", value=calendar_entry.end_date)
        event_status = Field(name="Status", type="EventStatus", value=calendar_entry.status)
        subject = StrField(name='Subject', value=calendar_entry.subject)
        details = StrField(name='Details', value=calendar_entry.details)
        category = StrField(name='Category', value=calendar_entry.category)
        repeat_rule = Field(name="RepeatRule", type="RepeatRule", value=calendar_entry.repeat_rule)
        repeat_day = Field(name="RepeatDay", type="RepeatDay", value=calendar_entry.repeat_day)
        repeat_interval = Field(name="RepeatInterval", type="UInt32", value=calendar_entry.repeat_interval)
        availability = Field(name="Availability", type="EventAvailability", value=calendar_entry.availability)
        event_class = Field(name="Class", type="EventClass", value=calendar_entry.event_class)
        event_location = StrField(name="Location", value=calendar_entry.location)

        fields = [start_time, end_time, event_status, subject, details, category, repeat_rule, repeat_day,
                  repeat_interval, availability, event_class, event_location]

        reminders = []
        if calendar_entry.reminders:
            for reminder in calendar_entry.reminders:
                reminders.append(EventFieldValue(type="TimeStamp", value=reminder.isoformat()))

        multi_fields.append(EventMultiField(name='Reminders', type='TimeStamp', values=reminders))

        attendees = []
        if calendar_entry.from_entity:
            attendee_entity = context.social_context[calendar_entry.from_entity]
            attendee_name = StrField(name="Name", value=formulate_entity_name(attendee_entity))
            attendee_identifier = StrField(name="Identifier", value=attendee_entity.phone)
            attendee_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=attendee_entity.is_owner)
            attendee_role = Field(name='Role', type='PartyRole', value='From')
            attendee_status = Field(name='Status', type='PartyStatus')
            attendees.append(Event(
                type="Party",
                id=attendee_entity.uid,
                source_index=context.source_index,
                fields=[attendee_identifier, attendee_role, attendee_status, attendee_name, attendee_is_owner]
            ))
        if calendar_entry.to_entities:
            for attendee in calendar_entry.to_entities:
                attendee_entity = context.social_context[attendee]
                attendee_name = StrField(name="Name", value=formulate_entity_name(attendee_entity))
                attendee_identifier = StrField(name="Identifier", value=attendee_entity.phone)
                attendee_is_owner = Field(name="IsPhoneOwner", type="Boolean", value=attendee_entity.is_owner)
                attendee_role = Field(name='Role', type='PartyRole', value='To')
                attendee_status = Field(name='Status', type='PartyStatus')
                attendees.append(Event(
                    type="Party",
                    id=attendee_entity.uid,
                    source_index=context.source_index,
                    fields=[attendee_identifier, attendee_role, attendee_status, attendee_name, attendee_is_owner]
                ))

        multi_model_fields.append(EventMultiModelField(name="Attendees", type="Party", events=attendees))

        # Attachments
        attachment_models = []
        if calendar_entry.attachments:
            for attachment in calendar_entry.attachments:
                attach_serializer = get_attachment_serializer(type(attachment))
                attachment_model = attach_serializer.serialize(context, attachment)
                attachment_models.append(attachment_model)

            attachments = EventMultiModelField(name="Attachments", type="Attachment", events=attachment_models)
            multi_model_fields.append(attachments)

        # EventPosition
        if calendar_entry.coordinate:
            event_position = create_coordinate_model_field(name='EventPosition',
                                                           longitude=calendar_entry.coordinate.lon,
                                                           latitude=calendar_entry.coordinate.lat)
            model_fields.append(event_position)

        calendar_model = Event(
            type="CalendarEntry",
            id=calendar_entry.uid,
            source_index=context.source_index,
            fields=fields,
            multi_fields=multi_fields,
            multi_model_fields=multi_model_fields,
            model_fields=model_fields
        )
        return calendar_model

    @classmethod
    def register_jump_targets(cls, context: SerializerContext, calendar_entry: CalendarEntry) -> None:
        if calendar_entry.attachments:
            for attachment in calendar_entry.attachments:
                if not attachment.is_sub_event:
                    context.register_jump_targets(calendar_entry, attachment)


@event_serializer(event_type=EventType.CELL_TOWER, model_type='CellTower')
class CellTowerSerializer(ReportModelSerializer[CellTower]):
    @classmethod
    def serialize(cls, context: SerializerContext, cell_tower: CellTower, **kwargs) -> Event:
        time = TimeField(name="TimeStamp", value=cell_tower.time)
        radio = Field(name="Type", type="CellTowerType", value=cell_tower.radio)
        mmc = StrField(name="MMC", value=cell_tower.mcc)
        mnc = StrField(name="MNC", value=cell_tower.mnc)
        cid = StrField(name="CID", value=cell_tower.cid)
        lac = StrField(name="LAC", value=cell_tower.lac)
        coordinate_model_field = create_coordinate_model_field(
            name="Position", latitude=cell_tower.lat, longitude=cell_tower.long
        )

        cell_tower_model = Event(
            type="CellTower",
            id=cell_tower.uid,
            source_index=context.source_index,
            fields=[time, radio, mmc, mnc, cid, lac],
            model_fields=[coordinate_model_field]
        )
        return cell_tower_model


@event_serializer(event_type=EventType.RECOGNIZED_DEVICE, model_type='RecognizedDevice')
class RecognizedDeviceSerializer(ReportModelSerializer[RecognizedDevice]):
    @classmethod
    def serialize(cls, context: SerializerContext, recognized_device: RecognizedDevice, **kwargs) -> Event:
        source = StrField(name="Source", value=recognized_device.source)
        name = StrField(name="Name", value=recognized_device.name)
        device_type = StrField(name="DeviceType", value=recognized_device.type)
        serial_number = StrField(name="SerialNumber", value=recognized_device.serial_number)
        device_model = StrField(name="DeviceModel", value=recognized_device.model)
        identifiers = EventMultiModelField(name="DeviceIdentifiers", type="KeyValueModel", events=[
            Event(
                type="KeyValueModel",
                id=str_uuid(),
                source_index=context.source_index,
                fields=[
                    StrField(name='Key', value=idn[0]),
                    StrField(name='Value', value=idn[1])
                ]
            )
            for idn in recognized_device.identifiers]
            if recognized_device.identifiers else None
        )
        recognized_device_model = Event(
            type="RecognizedDevice",
            id=recognized_device.uid,
            source_index=context.source_index,
            fields=[source, name, device_type, serial_number, device_model],
            multi_model_fields=[identifiers]
        )
        return recognized_device_model


@event_serializer(event_type=EventType.USER_ACCOUNT, model_type='UserAccount')
class UserAccountSerializer(ReportModelSerializer[UserAccount]):
    @classmethod
    def serialize(cls, context: SerializerContext, user_account: UserAccount, **kwargs) -> Event:
        user_name = StrField(name="Username", value=user_account.user_name)
        name = StrField(name="Name", value=user_account.name)
        password = StrField(name="Password", value=user_account.password)
        service_type = StrField(name="ServiceType", value=user_account.type)
        server_address = StrField(name="ServerAddress", value=user_account.address)
        time_created = TimeField(name="TimeCreated", value=user_account.creation_date)

        photos = EventMultiModelField(name="Photos", type="ContactPhoto", events=[])
        entries = EventMultiModelField(name="Entries", type="ContactEntry", events=[])
        addresses = EventMultiModelField(name="Addresses", type="StreetAddress", events=[])
        organizations = EventMultiModelField(name="Organization", type="Organization", events=[])

        notes = EventMultiField(name="Notes", type="String", values=[])

        user_account_model = Event(
            type="UserAccount",
            id=user_account.uid,
            source_index=context.source_index,
            fields=[name, user_name, password, service_type, server_address, time_created],
            multi_model_fields=[photos, entries, addresses, organizations],
            multi_fields=[notes]
        )
        return user_account_model


@event_serializer(event_type=EventType.POWERING_EVENT, model_type='PoweringEvent')
class PoweringEventSerializer(ReportModelSerializer[PoweringEvent]):
    @classmethod
    def serialize(cls, context: SerializerContext, powering_event: PoweringEvent, **kwargs) -> Event:
        event_name = Field(name="Event", type="PowerEventType", value=powering_event.event_name)
        element = Field(name="Element", type="PowerElementType", value="Device")
        timestamp = TimeField(value=powering_event.time)
        description = StrField(name="Description", value=powering_event.description)
        powering_event_model = Event(
            type="PoweringEvent",
            id=powering_event.uid,
            source_index=context.source_index,
            fields=[event_name, element, timestamp, description]
        )
        return powering_event_model


@attachment_serializer(event_types={Archive, Audio, Document, Image, Video})
class FileAttachmentSerializer(ReportAttachmentSerializer):
    @classmethod
    def serialize(cls, context: SerializerContext, file_data: FileData) -> Event:
        content_type = mimetypes.guess_type(file_data.path)[0] or 'Uncategorized'
        if isinstance(file_data, Archive):
            content_type = 'Archives'
        filename = StrField(name="Filename", value=file_data.path.name)
        content_type = StrField(name="ContentType", value=content_type)
        attachment_extracted_path = StrField(
            name="attachment_extracted_path",
            value=PureWindowsPath(file_data.path),
        )
        data = EventDataField(source=EventDataFieldValue(length=file_data.size))
        attachment_model = Event(
            type="Attachment",
            id=str_uuid(),
            source_index=context.source_index,
            file_id=file_data.uid,
            fields=[filename, content_type, attachment_extracted_path],
            data_fields=[data]
        )
        return attachment_model


@attachment_serializer(event_types={Location})
class LocationAttachmentSerializer(ReportAttachmentSerializer):
    @classmethod
    def serialize(cls, context: SerializerContext, location: Location) -> Event | None:
        if location.thumbnail is None:
            return None
        image_serializer = get_attachment_serializer(Image)
        return image_serializer.serialize(context, location.thumbnail)


@attachment_serializer(event_types={Contact})
class ContactAttachmentSerializer(ReportAttachmentSerializer):
    @classmethod
    def serialize(cls, context: SerializerContext, contact: Contact) -> Event:
        contact_serializer = get_serializer(EventType.CONTACT)
        contact_model = contact_serializer.serialize(context, contact)
        # ID of shared contact attachment cannot be identical to that of its corresponding regular Contact model
        contact_model.id = str_uuid()
        return contact_model
