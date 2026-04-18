from abc import ABC
from enum import StrEnum
from typing import Any, ClassVar, TYPE_CHECKING, Literal, Callable, Union

from pydantic import BaseModel, Field, ConfigDict, field_validator

from core.config import SETTINGS
from core.titan_logger import logger
from metafinder_core.models import ImageModel, VideoModel, AudioModel, FileModel, ChatModel, MetafinderModel, \
    EntityModel, ReportModelField, AppModel, CellTowerModel, UrlModel, LocalizedNameModel, CryptoModel, TextModel
from model.metafinder.data_types import DataType
from model.metafinder.queries import ArrayQuery

if TYPE_CHECKING:
    from metafinder_core.builders.base import BaseMetafinderQueryBuilder
    from metafinder_core.clients.base import BaseQueryClient
    from metafinder_core.parsers.base import BaseMetafinderQueryResponseParser
    

class MetaFinderQueryError(Exception):
    pass
    
    
def HiddenStaticField(value: Any) -> Field:
    return Field(value, json_schema_extra={"ui": {"field": "hidden"}}, frozen=True)


class MetaFinderIndex(StrEnum):
    Image = ("image_index_v2",)
    Chat = ("chats_index",)
    App = ("apps_index",)
    Audio = ("audio_index_v2",)
    Entity = ("entity_index",)
    Video = ("video_index_v2",)
    Text = ("text_index",)
    Field = ("fields_index",)
    Document = ("files_index",)
    CellTower = ("cell-towers",)
    Url = ('urls_index',)
    Name = ("name_index",)
    Crypto = ("crypto_index",)


def _handle_null_type_json_schema(property_schema: dict[str, Any]) -> dict[str, Any]:
    type_options = property_schema.get("anyOf")
    if type_options and len(type_options) == 2 and {"type": "null"} in type_options:
        type_options.remove({"type": "null"})
        for k, v in type_options[0].items():
            property_schema[k] = v
        property_schema["nullable"] = True
        property_schema.pop("anyOf")
    return property_schema


def metafinder_queries_schema_extra(schema: dict[str, Any], query_class: type["MetaFinderQueryParams"]) -> None:
    schema["title"] = f'Metafinder {query_class.data_type.value.title()}'
    
    for prop_name, prop_schema in schema["properties"].items():
        schema["properties"][prop_name] = _handle_null_type_json_schema(prop_schema)
        
        if prop_name == "categories":
            # Handle ArrayQuery
            schema["properties"][prop_name]["items"] = {}
    
    # Remove class docstring description
    schema.pop("description", None)
    # Set empty descriptions (e.g., to remove auto-set "An enumeration" for enum params) unless explicitly set
    for param in schema["properties"].values():
        param.setdefault("description", "")


class MetaFinderQueryParams[T: MetafinderModel](ABC, BaseModel):
    
    data_type: Literal[DataType]
    metafinder_model_class: type[T]
    id_field: str | Callable[[T], str] = HiddenStaticField("md5")
    index: MetaFinderIndex
    
    _builder: ClassVar["BaseMetafinderQueryBuilder"]
    _client: ClassVar["BaseQueryClient"]
    _parser: ClassVar["BaseMetafinderQueryResponseParser[T]"]
    
    model_config = ConfigDict(
        json_schema_extra=metafinder_queries_schema_extra,
        extra="ignore",
    )
    
    def __new__(cls, *args, **kwargs):
        from metafinder_core.builders.athena import AthenaMetafinderQueryBuilder
        from metafinder_core.clients.athena import AthenaClient
        from metafinder_core.parsers.athena import AthenaMetafinderQueryResponseParser
        
        cls._builder = AthenaMetafinderQueryBuilder()
        cls._client = AthenaClient(
            database_name=SETTINGS.METAFINDER_ATHENA_DATABASE_NAME,
            output_location=SETTINGS.METAFINDER_ATHENA_OUTPUT_LOCATION,
            aws_region=SETTINGS.AWS_REGION,
        )
        cls._parser = AthenaMetafinderQueryResponseParser[T]()
        
        return super().__new__(cls)
    
    def build(self, count: int = None) -> dict:
        raise NotImplementedError()
    
    def execute(self, query: dict | str) -> Any:
        return self._client.query(index=self.index, body=query)
    
    def parse(self, response: Any) -> list[T]:
        return self._parser.parse(response, model_class=self.metafinder_model_class)
    
    def query(self, count: int = None) -> list[T]:
        try:
            logger.debug(f"Requesting {count} {self.data_type} from MetaFinder")
            query = self.build(count)
            response = self.execute(query)
            results = self.parse(response)
            logger.debug(f"Received {len(results)} out of {count} {self.data_type} from MetaFinder")
        except Exception as e:
            raise MetaFinderQueryError(f"Error executing query: {e}")
        if not isinstance(results, list) or not results:
            raise MetaFinderQueryError(
                f"MetaFinder returned no results, requested count={count} "
                f"(type={self.data_type}, queries={self})"
            )
        return results
        

class ImageQueryParams(MetaFinderQueryParams[ImageModel]):
    data_type: Literal[DataType.Image] = HiddenStaticField(DataType.Image)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Image)
    metafinder_model_class: ImageModel = HiddenStaticField(ImageModel)
    
    min_size: int | None = Field(default=None)
    max_size: int | None = Field(default=None)
    formats: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "format"})
    min_height: int | None = Field(default=None)
    max_height: int | None = Field(default=None)
    min_width: int | None = Field(default=None)
    max_width: int | None = Field(default=None)
    categories: ArrayQuery | None = Field(default=None, title="Image Categories",
                                          json_schema_extra={"metafinder_key": "categories",
                                                             "ui": {"field": "arrayQuery"}})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.min_size or self.max_size:
            body = self._builder.size_query(body, min_size=self.min_size, max_size=self.max_size)
        if self.formats:
            body = self._builder.formats_query(body, self.formats)
        if self.min_height or self.max_height:
            body = self._builder.height_query(body, min_height=self.min_height, max_height=self.max_height)
        if self.min_width or self.max_width:
            body = self._builder.width_query(body, min_width=self.min_width, max_width=self.max_width)
        if self.categories and self.categories.values:
            body = self._builder.categories_query(body, self.categories)
        return body


class VideoQueryParams(MetaFinderQueryParams[VideoModel]):
    data_type: Literal[DataType.Video] = HiddenStaticField(DataType.Video)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Video)
    metafinder_model_class: VideoModel = HiddenStaticField(VideoModel)
    
    min_size: int | None = Field(default=None)
    max_size: int | None = Field(default=None)
    formats: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "format"})
    min_duration: int | None = Field(default=None)
    max_duration: int | None = Field(default=None)
    categories: ArrayQuery | None = Field(default=None, title="Video Categories",
                                          json_schema_extra={"metafinder_key": "categories",
                                                             "ui": {"field": "arrayQuery"}})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.min_size or self.max_size:
            body = self._builder.size_query(body, min_size=self.min_size, max_size=self.max_size)
        if self.formats:
            body = self._builder.formats_query(body, self.formats)
        if self.min_duration or self.max_duration:
            body = self._builder.duration_query(body, min_duration=self.min_duration, max_duration=self.max_duration)
        if self.categories and self.categories.values:
            body = self._builder.categories_query(body, self.categories)
        return body


class AudioQueryParams(MetaFinderQueryParams[AudioModel]):
    data_type: Literal[DataType.Audio] = HiddenStaticField(DataType.Audio)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Audio)
    metafinder_model_class: AudioModel = HiddenStaticField(AudioModel)
    
    min_size: int | None = Field(default=None)
    max_size: int | None = Field(default=None)
    formats: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "format"})
    min_duration: int | None = Field(default=None)
    max_duration: int | None = Field(default=None)
    categories: ArrayQuery | None = Field(default=None, title="Audio Categories",
                                          json_schema_extra={"metafinder_key": "categories",
                                                             "ui": {"field": "arrayQuery"}})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.min_size or self.max_size:
            body = self._builder.size_query(body, min_size=self.min_size, max_size=self.max_size)
        if self.formats:
            body = self._builder.formats_query(body, self.formats)
        if self.min_duration or self.max_duration:
            body = self._builder.duration_query(body, min_duration=self.min_duration, max_duration=self.max_duration)
        if self.categories and self.categories.values:
            body = self._builder.categories_query(body, self.categories)
        return body


class DocumentQueryParams(MetaFinderQueryParams[FileModel]):
    data_type: Literal[DataType.Document] = HiddenStaticField(DataType.Document)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Document)
    metafinder_model_class: FileModel = HiddenStaticField(FileModel)
    
    min_size: int | None = Field(default=None)
    max_size: int | None = Field(default=None)
    formats: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "format"})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.min_size or self.max_size:
            body = self._builder.size_query(body, min_size=self.min_size, max_size=self.max_size)
        if self.formats:
            body = self._builder.formats_query(body, self.formats)
        return body


class ChatQueryParams(MetaFinderQueryParams[ChatModel]):
    data_type: Literal[DataType.Chat] = HiddenStaticField(DataType.Chat)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Chat)
    metafinder_model_class: ChatModel = HiddenStaticField(ChatModel)
    
    languages: list[str] | None = Field(default_factory=list, json_schema_extra={"metafinder_key": "language"})
    categories: ArrayQuery | None = Field(default=None, title="Text Categories",
                                          json_schema_extra={"metafinder_key": "categories",
                                                             "ui": {"field": "arrayQuery"}})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.languages:
            body = self._builder.language_query(body, self.languages)
        if self.categories and self.categories.values:
            body = self._builder.categories_query(body, self.categories)
        return body


class TextQueryParams(MetaFinderQueryParams[TextModel]):
    data_type: Literal[DataType.Text] = HiddenStaticField(DataType.Text)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Text)
    metafinder_model_class: TextModel = HiddenStaticField(TextModel)
    
    min_size: int | None = Field(default=None)
    max_size: int | None = Field(default=None)
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.min_size or self.max_size:
            body = self._builder.size_query(body, min_size=self.min_size, max_size=self.max_size)
        return body


class ApplicationQueryParams(MetaFinderQueryParams[AppModel]):
    data_type: Literal[DataType.Application] = HiddenStaticField(DataType.Application)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.App)
    metafinder_model_class: AppModel = HiddenStaticField(AppModel)
    
    app_ids: list[str] = Field(default_factory=list)
    category: str | None = Field(default=None)
    os: Literal['ios', 'android'] | None = Field(default=None)
    
    @field_validator('os', mode='before')
    def _validate_os(cls, v):
        if v:
            return v.lower()
        return v
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.app_ids:
            body = self._builder.id_query(body, self.app_ids)
        if self.category:
            body = self._builder.category_query(body, self.category)
        if self.os:
            body = self._builder.os_query(body, self.os)
        return body


class EntityQueryParams(MetaFinderQueryParams[EntityModel]):
    data_type: Literal[DataType.Entity] = HiddenStaticField(DataType.Entity)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Entity)
    metafinder_model_class: EntityModel = HiddenStaticField(EntityModel)
    
    id: list[str] = Field(default_factory=list)
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.id:
            body = self._builder.id_query(body, self.id)
        return body


class ReportFieldQueryParams(MetaFinderQueryParams[ReportModelField]):
    data_type: Literal[DataType.ReportField] = HiddenStaticField(DataType.ReportField)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Field)
    metafinder_model_class: ReportModelField = HiddenStaticField(ReportModelField)
    
    model_type: str | None = Field(default=None)
    
    def build(self, _count: int = None) -> dict | str:
        return self._client.get_report_fields(model_type=self.model_type, index=self.index)
        


class CellTowerQueryParams(MetaFinderQueryParams[CellTowerModel]):
    data_type: Literal[DataType.CellTower] = HiddenStaticField(DataType.CellTower)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.CellTower)
    metafinder_model_class: CellTowerModel = HiddenStaticField(CellTowerModel)
    
    lat: float | None = Field(default=None)
    lon: float | None = Field(default=None)
    mcc: list[int] = Field(default_factory=list)
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.lat and self.lon:
            body = self._builder.radius_query(body=body, lat=self.lat, lon=self.lon)
            body = self._builder.radius_sort_query(body=body, lat=self.lat, lon=self.lon)
        if self.mcc:
            body = self._builder.mcc_query(body=body, mcc=self.mcc)
        return body


class UrlQueryParams(MetaFinderQueryParams[UrlModel]):
    data_type: Literal[DataType.URL] = HiddenStaticField(DataType.URL)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Url)
    metafinder_model_class: UrlModel= HiddenStaticField(UrlModel)
    
    categories: ArrayQuery | None = Field(default=None, title="URL Categories",
                                          json_schema_extra={"ui": {"field": "arrayQuery"}})
    cctld: list[str] = Field(default_factory=list)
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.categories and self.categories.values:
            body = self._builder.categories_query(body, self.categories)
        if self.cctld:
            body = self._builder.cctld_query(body=body, cctld=self.cctld)
        return body


class NameQueryParams(MetaFinderQueryParams[LocalizedNameModel]):
    data_type: Literal[DataType.Name] = HiddenStaticField(DataType.Name)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Name)
    metafinder_model_class: LocalizedNameModel = HiddenStaticField(LocalizedNameModel)
    
    is_surname: bool | None = Field(default=None)
    is_male: bool | None = Field(default=None)
    country_code: str | None = Field(default=None)
    alphabet: str | None = Field(default=None)
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.is_surname is not None:
            body = self._builder.is_surname_query(body, self.is_surname)
        if self.is_male is not None:
                body = self._builder.is_male_query(body, self.is_male)
        if self.country_code is not None:
            body = self._builder.country_code_query(body, self.country_code)
        if self.alphabet is not None:
            body = self._builder.alphabet_query(body, self.alphabet)
        return body


class CryptoQueryParams(MetaFinderQueryParams[CryptoModel]):
    data_type: Literal[DataType.Crypto] = HiddenStaticField(DataType.Crypto)
    index: MetaFinderIndex = HiddenStaticField(MetaFinderIndex.Crypto)
    metafinder_model_class: CryptoModel = HiddenStaticField(CryptoModel)
    
    languages: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "language"})
    coins: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "coin"})
    types: list[str] = Field(default_factory=list, json_schema_extra={"metafinder_key": "type"})
    
    def build(self, count: int = None) -> dict:
        body = self._builder.init_query_body(count)
        if self.languages:
            body = self._builder.language_query(body, self.languages)
        if self.coins:
            body = self._builder.coins_query(body, self.coins)
        if self.types:
            body = self._builder.type_query(body, self.types)
        return body

QueryParamsUnion = Union[
    ImageQueryParams,
    VideoQueryParams,
    AudioQueryParams,
    DocumentQueryParams,
    ChatQueryParams,
    TextQueryParams,
    ApplicationQueryParams,
    EntityQueryParams,
    ReportFieldQueryParams,
    CellTowerQueryParams,
    UrlQueryParams,
    NameQueryParams,
    CryptoQueryParams,
]

class GetQueryClass(BaseModel):
    queries: QueryParamsUnion | None = Field(discriminator='data_type')

def get_queries_class(data_type: DataType) -> type[MetaFinderQueryParams]:
    query_class = GetQueryClass.model_validate({"queries": {"data_type": data_type}})
    return type(query_class.queries)
    