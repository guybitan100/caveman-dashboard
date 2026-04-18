import json
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Iterator, Optional, Set

import click
from pydantic.json import pydantic_encoder

from metafinder_core.models import ReportModelField
from model.job import ReportModelFieldType
from generation.conversion.report import Event
from utils.ufdr import parser


MAX_FIELD_VALUES = (
    10  # If the number of unique field values is great than this value, we disregard it as a potential enum
)


@dataclass(frozen=True, eq=True, order=True)
class _ReportModelFieldValue:
    version: str
    model_type: str
    field_type: ReportModelFieldType
    name: str
    value_type: str
    is_sub_field: bool
    multi_model_types: Optional[Set[str]] = field(default=None, compare=False)
    value: Optional[str] = field(default=None, compare=False)


@click.command()
@click.option(
    "--input-path",
    "-i",
    required=True,
    type=Path,
    help="Path to UFDR or report XML file",
)
@click.option(
    "--output-path",
    "-o",
    required=True,
    type=Path,
    help="Path to field structure output file",
)
@click.option(
    "--max-values",
    type=int,
    default=MAX_FIELD_VALUES,
    help="Maximum potential enum values to output in field structure",
)
@click.option(
    "--no-max-values",
    is_flag=True,
    help="Flag indicating if no potential enum value filtering should occur",
)
def save_report_field_structure(input_path: Path, output_path: Path, max_values: int, no_max_values: bool):
    fields = create_report_field_structure(path=input_path, max_values=None if no_max_values else max_values)
    with output_path.open("w") as f:
        json.dump(fields, f, default=pydantic_encoder)


def create_report_field_structure(path: Path, max_values: Optional[int] = MAX_FIELD_VALUES) -> List[ReportModelField]:
    report = parser.parse_report(path=path)

    # Gather all field  instances
    fields_values = (
        field_value
        for model_type in report.decoded_data.event_types
        for model in model_type.events
        for field_value in _get_all_fields(model, version=report.version)
    )

    # Group fields by their attrs and aggregate unique values
    fields = list(_aggregate_fields_values(fields_values, max_values=max_values))

    return fields


def _get_all_fields(model: Event, version: str, is_sub_field: bool = False) -> Iterator[_ReportModelFieldValue]:
    for field_type, fields in zip(
        ReportModelFieldType,
        [
            model.fields,
            model.multi_fields,
            model.model_fields,
            model.multi_model_fields,
        ],
    ):
        for field in fields:
            value = None  # Only set for field type "field" and when a value exists
            sub_model_types = None  # Only set when field type is "multiModelField"

            if field_type == ReportModelFieldType.FIELD:
                if field.field_value:
                    value = field.field_value.value
            elif field_type == ReportModelFieldType.MODEL_FIELD:
                if field.event is not None:
                    yield from _get_all_fields(model=field.event, version=version, is_sub_field=True)
            elif field_type == ReportModelFieldType.MULTI_MODEL_FIELD:
                # Gather list of possible model types in multi model list
                sub_model_types = set(sub_model.type for sub_model in field.events)
                # Iterate over listed models
                for sub_model in field.events:
                    yield from _get_all_fields(model=sub_model, version=version, is_sub_field=True)
            # ReportModelFieldType.MULTI_FIELD value will be None (we don't record values for potential enums yet(?))

            # Create field record
            yield _ReportModelFieldValue(
                version=version,
                model_type=model.type,
                field_type=field_type,
                name=field.name,
                value_type=field.type,
                is_sub_field=is_sub_field,
                multi_model_types=sub_model_types,
                value=value,
            )


def _aggregate_fields_values(
    fields_values: List[_ReportModelFieldValue], max_values: Optional[int]
) -> Iterator[ReportModelField]:
    agg = defaultdict(set)
    multi_model_sub_types = defaultdict(set)

    # Index all fields of all field types and their values if any
    for field_value in fields_values:
        agg[field_value].add(field_value.value)
        # Index sub-model types of any multiModel fields (because multi model fields can have mixed sub-model types)
        if field_value.field_type == ReportModelFieldType.MULTI_MODEL_FIELD and field_value.multi_model_types:
            multi_model_sub_types[field_value].update(field_value.multi_model_types)

    for field_value, values in agg.items():
        if None in values:
            values.remove(None)
        if max_values is not None and len(values) > max_values:
            values = []
        field_value_attrs = asdict(field_value)
        if field_value.field_type == ReportModelFieldType.MULTI_MODEL_FIELD:  # Retrieve sub-model types for multiModel
            field_value_attrs["multi_model_types"] = tuple(multi_model_sub_types[field_value])
        field = ReportModelField(**field_value_attrs, values=list(values))
        yield field


if __name__ == "__main__":
    save_report_field_structure()
