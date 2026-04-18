
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Gender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class VoiceCharacteristics(BaseModel):

    voice_id: str | None = Field(
        default=None,
        description="Nova Sonic voice ID (will be auto-selected based on gender/age if not provided)"
    )

    language_code: str = Field(
        default="en-US",
        description="BCP-47 language code for speech synthesis (e.g., 'en-US', 'es-ES', 'fr-FR')"
    )

    speaking_style: Literal["calm", "excited", "professional", "casual", "urgent"] | None = Field(
        default=None,
        description="Speaking style/tone for the voice"
    )



class EntityCharacteristics(BaseModel):
    
    age: int | None = Field(
        default=None,
        ge=0,
        le=120,
        description="Age of the entity"
    )
    
    gender: Gender = Field(
        default=Gender.UNKNOWN,
        description="Gender of the entity"
    )
    
    occupation: str | None = Field(
        default=None,
        description="Job or profession"
    )
    
    personality_traits: list[str] = Field(
        default_factory=list,
        description="Key personality traits (e.g., 'introverted', 'analytical', 'aggressive')"
    )
    
    background: str | None = Field(
        default=None,
        description="Brief background information relevant to the story"
    )
    
    tech_savviness: int = Field(
        default=5,
        ge=1,
        le=10,
        description="How tech-savvy (1=technophobe, 10=power user) - affects phone usage patterns"
    )
    
    social_activity: int = Field(
        default=5,
        ge=1,
        le=10,
        description="How socially active (1=recluse, 10=social butterfly) - affects communication volume"
    )

    location: str | None = Field(
        default=None,
        description="City or region where the entity is located (e.g., 'New York', 'Los Angeles', 'Chicago')"
    )

    voice: VoiceCharacteristics | None = Field(
        default=None,
        description="Voice characteristics for audio generation (auto-selected if not provided)"
    )


class Language(BaseModel):
    name: str = Field(description="Name of the language.")
    is_native: bool = Field(description="Is this the native language of the entity?")
    proficiency: str = Field(description="Proficiency level in the language.")


class Entity(BaseModel):
    
    entity_id: str = Field(
        description="Unique identifier for this entity"
    )
    
    name: str = Field(
        description="Full name of the entity"
    )

    characteristics: EntityCharacteristics = Field(
        description="Detailed characteristics of the entity"
    )
    languages: list[Language] = Field(
        default_factory=list,
        description="Languages known by the entity"
    )
    
    phone_numbers: list[str] = Field(
       default_factory=list,
        description="Phone number if applicable"
    )
    
    emails: list[str] = Field(
        default_factory=list,
        description="Email address if applicable"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "entity_id": "ent_001",
                "name": "Sarah Chen",
                "role": "owner",
                "characteristics": {
                    "age": 34,
                    "gender": "female",
                    "occupation": "Detective",
                    "personality_traits": ["analytical", "persistent", "empathetic"],
                    "background": "10 years in homicide, recently transferred from Seattle",
                    "tech_savviness": 7,
                    "social_activity": 4
                },
                "languages": [
                    {
                        "name": "English",
                        "is_native": True,
                        "proficiency": "native"
                    },
                    {
                        "name": "Spanish",
                        "is_native": False,
                        "proficiency": "conversational"
                    }
                ],
                "phone_numbers": ["+1-555-0123"],
                "emails": ["sarah.chen@millbrookpd.gov"]
            }
        }
    }
