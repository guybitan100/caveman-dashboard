from collections import defaultdict

from core.six_logger import logger
from model.job import CustomEvent, CustomEventFieldValues, ReportModelFieldType, CustomEventFieldValue, \
    CustomEventMultiFieldValue, CustomEventModelFieldValue, CustomEventMultiModelFieldValue
from model.utils import str_uuid
from generation.conversion.report import Event, EventField, EventModelField, EventMultiModelField, EventMultiField, \
    EventFieldValue


def generate_custom_models(custom_events: list[CustomEvent]) -> dict[str, list[Event]]:
    model_types = defaultdict(list)
    for custom_event in custom_events:
        event = _generate_custom_event(event_type=custom_event.model_type, custom_fields=custom_event.fields)
        model_types[custom_event.model_type].append(event)
    return model_types


def _generate_custom_event(event_type: str, custom_fields: dict[str, CustomEventFieldValues]) -> Event:
    # Instantiate lists of event fields per type
    fields = []
    multi_fields = []
    model_fields = []
    multi_model_fields = []

    for field_name, custom_field in custom_fields.items():
        try:
            if custom_field.field_type is ReportModelFieldType.FIELD:
                fields.append(_generate_field(field_name=field_name, custom_field=custom_field))
            elif custom_field.field_type is ReportModelFieldType.MULTI_FIELD:
                multi_fields.append(_generate_multi_field(field_name=field_name, custom_field=custom_field))
            elif custom_field.field_type is ReportModelFieldType.MODEL_FIELD:
                model_fields.append(_generate_model_field(field_name=field_name, custom_field=custom_field))
            elif custom_field.field_type is ReportModelFieldType.MULTI_MODEL_FIELD:
                multi_model_fields.append(_generate_multi_model_field(field_name=field_name, custom_field=custom_field))
        except Exception as e:
            logger.warn(
                f'Error in converting field "{field_name}" for event type "{event_type}": {str(e)}',
                field_name=field_name, event_type=event_type, error=e
            )

    event = Event(
        id=str_uuid(),
        type=event_type,
        fields=fields,
        multi_fields=multi_fields,
        model_fields=model_fields,
        multi_model_fields=multi_model_fields,
    )

    return event


def _generate_field(field_name: str, custom_field: CustomEventFieldValue) -> EventField:
    return EventField(
        name=field_name,
        type=custom_field.value_type,
        field_value=EventFieldValue(type=custom_field.value_type, value=custom_field.value),
    )


def _generate_multi_field(field_name: str, custom_field: CustomEventMultiFieldValue) -> EventMultiField:
    return EventMultiField(
        name=field_name,
        type=custom_field.value_type,
        values=[EventFieldValue(type=custom_field.value_type, value=val) for val in custom_field.value],
    )


def _generate_model_field(field_name: str, custom_field: CustomEventModelFieldValue) -> EventModelField:
    if custom_field.fields:
        event = _generate_custom_event(event_type=custom_field.value_type, custom_fields=custom_field.fields)
    else:
        event = None
    return EventModelField(name=field_name, type=custom_field.value_type, event=event)


def _generate_multi_model_field(field_name: str, custom_field: CustomEventMultiModelFieldValue) -> EventMultiModelField:
    events = [
        _generate_custom_event(
            event_type=custom_model_field.value_type,
            custom_fields=custom_model_field.fields,
        )
        for custom_model_field in custom_field.models
    ]
    return EventMultiModelField(name=field_name, type=custom_field.value_type, events=events)
