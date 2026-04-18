from enum import Enum


class TitanPhase(Enum):
    Initialization = "initialization"
    Generation = "generation"
    Conversion = "conversion"
    Finalization = "finalization"
    Completion = "completion"
