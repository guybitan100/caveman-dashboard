from enum import StrEnum

class DataType(StrEnum):

    Image = "image"
    Video = "video"
    Document = "document"
    Text = "text"
    Chat = "chat"
    Application = "app"
    Entity = "entity"
    ReportField = "field"
    Audio = "audio"
    CellTower = "cell-tower"
    URL = 'url'
    Name = "name"
    Crypto = "crypto"


data_type_count_limit = {
    DataType.Text: 300,
    DataType.Image: 2000,
    DataType.Audio: 2000,
    DataType.Video: 2000,
    DataType.Document: 2000,
}


class KeywordTerms(StrEnum):

    Categories = "categories"
    Format = "format"
    Language = "language"
    CCTld = 'cctld'
    CountryCode = "country_code"
    Alphabet = "alphabet"
    Type = "type"
    Coin = "coin"


class RangeTerms(StrEnum):

    Size = "size"
    Duration = "duration"
    Height = "height"
    Width = "width"



