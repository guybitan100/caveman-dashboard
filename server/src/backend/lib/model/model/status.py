from enum import StrEnum


class JobStatus(StrEnum):
    Draft = "Draft"
    Pending = "Pending"
    Generating = "Generating"
    Converting = "Converting"
    Finalizing = "Finalizing"
    Done = "Done"
    Cancelled = "Cancelled"
    Failed = "Failed"
    Deleted = "Deleted"


class GenerationTaskStatus(StrEnum):
    Pending = "Pending"
    Generating = "Generating"
    Done = "Done"
    Cancelled = "Cancelled"
    Failed = "Failed"
    Partial = "Partial"


class PhaseStatus(StrEnum):
    Running = "Running"
    Done = "Done"
    Failed = "Failed"


class ValidationStatus(StrEnum):
    Success = "Success"
    Failure = "Failure"
    PartialSucces = "PartialSuccess"
