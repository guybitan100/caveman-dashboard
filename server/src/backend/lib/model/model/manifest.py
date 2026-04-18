from pydantic import BaseModel


class ManifestEvent(BaseModel):

    model_name: str
    count: int


class Manifest(BaseModel):

    id: str
    name: str
    events: list[ManifestEvent]
    files: list[ManifestEvent]
