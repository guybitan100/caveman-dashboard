from enum import Enum


class SixPhase(Enum):
    Initialization = "initialization"
    Generation = "generation"
    Conversion = "conversion"
    Finalization = "finalization"
    Completion = "completion"
