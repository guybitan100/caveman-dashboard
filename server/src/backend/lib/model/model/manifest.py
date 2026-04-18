from pydantic import BaseModel


class ManifestEvent(BaseModel):
    """
    Raw representation of manifest item.

    Attributes:
        model_name:     Name of the event, derived from report.xml modelType type.
        count:          Count of the event at the UFDR.
    """

    model_name: str
    count: int


class Manifest(BaseModel):
    """
    Manifest object of SiX job.

    Representing all model names and count of model at SiX generated extraction.

    Attributes:
        id:        Id of the job.
        name:      Name of the job.
        events:     List of the job events.
        files:     List of the job files.
    """

    id: str
    name: str
    events: list[ManifestEvent]
    files: list[ManifestEvent]
