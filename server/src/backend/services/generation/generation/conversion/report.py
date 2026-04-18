from dataclasses import dataclass, field, MISSING
from typing import List, Optional

from xsdata.utils import text


NAMESPACE = "http://pa.cellebrite.com/report/2.0"


#######################################################################################################################
# NOTE: Unless explicitly specified, all report fields have a default value of None, but not all are typed as Optional.
#######################################################################################################################


def _define_xml(type: str, name: Optional[str] = None, default_factory=MISSING, default=None, **kwargs):
    metadata = {"type": type}
    if name is not None:
        metadata["name"] = name
    if default_factory is not MISSING:  # if default_factory is specified, dataclasses forbids default to be set
        default = MISSING  # revert from our default (None) to dataclasses default (MISSING)
    return field(default_factory=default_factory, default=default, metadata=metadata, **kwargs)


def Attribute(**kwargs):
    return _define_xml(type="Attribute", **kwargs)


def Element(**kwargs):
    return _define_xml(type="Element", **kwargs)


def ListElement(**kwargs):
    return Element(default_factory=list, **kwargs)


@dataclass
class Timestamp:
    class Meta:
        name = "timestamp"

    value: str
    name: str = Attribute()


@dataclass
class Item:
    class Meta:
        name = "item"

    name: str = Attribute()
    id: str = Attribute()
    group: str = Attribute()
    extraction: str = Attribute(name="sourceExtraction")
    value: Optional[str] = None


@dataclass
class AccessInfo:
    class Meta:
        name = "accessInfo"

    timestamps: List[Timestamp] = ListElement(name="timestamp")


@dataclass
class Metadata:
    class Meta:
        name = "metadata"

    items: List[Item] = ListElement(name="item")
    section: str = Attribute()


@dataclass
class TargetId:
    class Meta:
        name = "targetid"

    value: str
    is_model: bool = Attribute(name="ismodel")


@dataclass
class JumpTargets:
    class Meta:
        name = "jumptargets"

    target_ids: List[TargetId] = ListElement(name="targetid")
    name: str = Attribute(default="")


@dataclass
class File:
    class Meta:
        name = "file"

    fs: str = Attribute()
    fsid: str = Attribute()
    path: str = Attribute()
    #TODO name
    size: int = Attribute()
    id: str = Attribute()
    extraction_id: str = Attribute(name="extractionId", default="0")
    deleted: str = Attribute()
    embedded: bool = Attribute(default='false')
    isrelated: str = Attribute(default='False')
    source_index: int = Attribute()

    access_info: AccessInfo = Element(name="accessInfo")
    metadata_file: Metadata = Element(name="metadata")
    metadata: Metadata = Element(name="metadata")
    jump_targets: Optional[JumpTargets] = Element(name="jumptargets")


@dataclass
class NodeInfo:
    class Meta:
        name = "nodeInfo"

    id: str = Attribute(name="id")
    table_name: str = Attribute(name="tableName")
    offset: str = Attribute(name="offset")


@dataclass
class NodeInfos:
    class Meta:
        name = "nodeInfos"

    node_infos: List[NodeInfo] = ListElement(name='nodeInfo')


@dataclass
class SourceInfo:
    class Meta:
        name = "sourceInfo"

    node_infos: Optional[NodeInfos] = Element(name="nodeInfos")
    node_info: Optional[NodeInfo] = Element(name="nodeInfo")


@dataclass
class ExtraInfo:
    class Meta:
        name = "extraInfo"

    source_info: SourceInfo = Element(name="sourceInfo")
    type: str = Attribute(name="type")
    id: str = Attribute(name="id")


@dataclass
class ExtraInfos:
    class Meta:
        name = "extraInfos"

    fields: List[ExtraInfo] = ListElement(name="extraInfo")


@dataclass
class TaggedFiles:
    class Meta:
        name = "taggedFiles"

    files: List[File] = ListElement(name="file")


@dataclass
class EventFieldValue:
    class Meta:
        name = "value"

    type: str = Attribute()
    value: str = ""


@dataclass
class EventDataFieldValue:
    class Meta:
        name = "source"

    length: int = Attribute()


@dataclass
class EmptyEventFieldValue:
    class Meta:
        name = "empty"

    value: Optional[str] = None


@dataclass
class BaseEventField:
    name: str = Attribute()
    type: str = Attribute()


@dataclass
class EventField(BaseEventField):
    class Meta:
        name = "field"

    field_value: Optional[EventFieldValue] = Element(name="value")
    empty_value: Optional[EmptyEventFieldValue] = Element(name="empty")

    def get_value(self) -> Optional[str]:
        return self.field_value.value if self.field_value else None


@dataclass
class EventDataField(BaseEventField):
    source: EventDataFieldValue = Element(name="source")


@dataclass
class EventMultiField:
    class Meta:
        name = "multiField"

    name: str = Attribute()
    type: str = Attribute()

    values: Optional[List[EventFieldValue]] = Element(name="value")


@dataclass
class EventModelField:
    class Meta:
        name = "modelField"

    name: str = Attribute()
    type: str = Attribute()

    event: Optional["Event"] = Element(name="model")
    empty_value: Optional[EmptyEventFieldValue] = Element(name="empty")


@dataclass
class EventMultiModelField:
    class Meta:
        name = "multiModelField"

    events: List["Event"] = ListElement(name="model")
    name: str = Attribute()
    type: str = Attribute()


@dataclass
class Event:
    class Meta:
        name = "model"

    fields: List[EventField] = ListElement(name="field")
    multi_fields: List[EventMultiField] = ListElement(name="multiField")
    model_fields: List[EventModelField] = ListElement(name="modelField")
    multi_model_fields: List[EventMultiModelField] = ListElement(name="multiModelField")
    data_fields: List[EventDataField] = ListElement(name="dataField")
    jump_targets: Optional[JumpTargets] = Element(name="jumptargets")

    type: str = Attribute()
    id: str = Attribute()
    deleted_state: str = Attribute(default='Intact')
    decoding_confidence: str = Attribute(default='High')
    isrelated: str = Attribute(default='False')
    source_index: int = Attribute()
    extraction_id: str = Attribute(name="extractionId", default="0")
    file_id: str = Attribute()


@dataclass
class ModelType:
    class Meta:
        name = "modelType"

    events: List[Event] = ListElement(name="model")
    type: str = Attribute()


@dataclass
class DecodedData:
    class Meta:
        name = "decodedData"

    event_types: List[ModelType] = ListElement(name="modelType")


@dataclass
class ExtractionInfo:
    class Meta:
        name = "extractionInfo"
        attribute_name_generator = text.camel_case

    id: int = Attribute()
    name: str = Attribute()
    is_custom_name: str = Attribute(default='False')
    type: str = Attribute()
    device_name: str = Attribute()
    full_name: str = Attribute()
    index: int = Attribute()
    is_partial_data: str = Attribute(name="IsPartialData", default='False')


@dataclass
class SourceExtractions:
    class Meta:
        name = "sourceExtractions"

    extraction_infos: List[ExtractionInfo] = ListElement(name="extractionInfo")


@dataclass
class InfoField:
    class Meta:
        name = "field"
        attribute_name_generator = text.camel_case

    name: str = Attribute()
    is_system: bool = Attribute()
    is_required: bool = Attribute()
    field_type: str = Attribute()
    multiple_lines: bool = Attribute()
    value: Optional[str] = None


@dataclass
class CaseInformation:
    class Meta:
        name = "caseInformation"

    fields: List[InfoField] = ListElement(name="field")


@dataclass
class Image:
    class Meta:
        name = "image"

    metadatas: List[Metadata] = ListElement(name="metadata")

    key: str = Attribute()
    path: str = Attribute()
    size: int = Attribute()
    type: str = Attribute()
    verify: str = Attribute()
    extraction_id: str = Attribute(name="extractionId")


@dataclass
class Images:
    class Meta:
        name = "images"

    images: List[Image] = ListElement(name="field")


@dataclass
class TimeZoneConfigurations:
    class Meta:
        name = "timeZoneConfigurations"

    enable_daylight_savings: bool = Attribute(name="enableDaylightSavings")
    enable_automatically_convert_to_utc: bool = Attribute(name="enableAutomaticallyConvertToUTC")
    selected_time_zone: str = Attribute(name="selectedTimeZone")


@dataclass
class ProjectConfigurations:
    class Meta:
        name = "projectConfigurations"

    timezone: Optional[TimeZoneConfigurations] = Element(name="timeZoneConfigurations")


@dataclass
class Report:
    class Meta:
        name = "project"
        namespace = NAMESPACE

    extractions: SourceExtractions = Element(name="sourceExtractions", default_factory=SourceExtractions)
    case_info: CaseInformation = Element(name="caseInformation", default_factory=CaseInformation)
    metadatas: List[Metadata] = ListElement(name="metadata")
    images: Images = Element(name="images", default_factory=Images)
    tagged_files: TaggedFiles = Element(name="taggedFiles", default_factory=TaggedFiles)
    decoded_data: DecodedData = Element(name="decodedData", default_factory=DecodedData)
    extra_infos: ExtraInfos = Element(name="extraInfos", default_factory=ExtraInfos)
    project_configs: ProjectConfigurations = Element(
        name="projectConfigurations", default_factory=ProjectConfigurations
    )

    id: str = Attribute()
    name: str = Attribute()
    version: str = Attribute(name="reportVersion")
    license_id: str = Attribute(name="licenseID")
    extraction_type: str = Attribute(name="extractionType")
    contains_garbage: bool = Attribute(name="containsGarbage", default=False)