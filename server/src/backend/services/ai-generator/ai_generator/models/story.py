
from datetime import datetime
from pydantic import BaseModel, Field


class StoryExpansion(BaseModel):
    
    original_description: str = Field(
        description="The original short description provided by the user"
    )
    
    expanded_narrative: str = Field(
        description="The full, detailed story narrative with rich context, character development, and plot details"
    )
    
    setting: str = Field(
        description="Time period and location context for the story"
    )
    
    key_themes: list[str] = Field(
        default_factory=list,
        description="Main themes and motifs in the story (e.g., 'crime', 'romance', 'betrayal')"
    )
    
    generated_at: datetime = Field(
        default_factory=datetime.now,
        description="When this expansion was generated"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "original_description": "A detective investigating a murder in a small town",
                "expanded_narrative": "Detective Sarah Chen arrived in Millbrook on a cold November morning...",
                "setting": "Modern day, small coastal town in Oregon",
                "key_themes": ["mystery", "small-town secrets", "justice"],
                "generated_at": "2025-12-03T10:30:00"
            }
        }
    }
