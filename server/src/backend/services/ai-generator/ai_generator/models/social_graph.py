
from enum import StrEnum
from pydantic import BaseModel, Field


class RelationshipType(StrEnum):
    FAMILY = "family"
    ROMANTIC = "romantic"
    FRIEND = "friend"
    COLLEAGUE = "colleague"
    ACQUAINTANCE = "acquaintance"
    NEIGHBOR = "neighbor"
    RIVAL = "rival"
    ENEMY = "enemy"
    PROFESSIONAL = "professional"  # e.g., doctor-patient, lawyer-client
    STRANGER = "stranger"
    SERVICE_PROVIDER = "service_provider"  # e.g., customer-service rep
    OTHER = "other"


class Relationship(BaseModel):
    
    entity_id_1: str = Field(
        description="ID of the first entity in the relationship"
    )
    
    entity_id_2: str = Field(
        description="ID of the second entity in the relationship"
    )
    
    relationship_type: RelationshipType = Field(
        description="Type of relationship"
    )
    
    strength: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Strength of relationship (1=weak, 10=very strong)"
    )
    
    description: str = Field(
        description="Detailed description of the relationship (e.g., 'Brother and sister, close since childhood')"
    )
    
    is_bidirectional: bool = Field(
        default=True,
        description="Whether the relationship is mutual or one-directional"
    )
    
    communication_frequency: int = Field(
        default=5,
        ge=1,
        le=10,
        description="How frequently they communicate (1=rarely, 10=constantly) - affects event generation"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "entity_id_1": "ent_001",
                "entity_id_2": "ent_002",
                "relationship_type": "colleague",
                "strength": 7,
                "description": "Partner detectives, worked together for 2 years",
                "is_bidirectional": True,
                "communication_frequency": 8
            }
        }
    }


class SocialGraph(BaseModel):
    
    relationships: list[Relationship] = Field(
        default_factory=list,
        description="All relationships between entities"
    )
    
    def get_relationships_for_entity(self, entity_id: str) -> list[Relationship]:
        return [
            rel for rel in self.relationships
            if rel.entity_id_1 == entity_id or rel.entity_id_2 == entity_id
        ]
    
    def get_connected_entities(self, entity_id: str) -> set[str]:
        connected = set()
        for rel in self.relationships:
            if rel.entity_id_1 == entity_id:
                connected.add(rel.entity_id_2)
            elif rel.entity_id_2 == entity_id:
                connected.add(rel.entity_id_1)
        return connected
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "relationships": [
                    {
                        "entity_id_1": "ent_001",
                        "entity_id_2": "ent_002",
                        "relationship_type": "colleague",
                        "strength": 7,
                        "description": "Partner detectives",
                        "is_bidirectional": True,
                        "communication_frequency": 8
                    }
                ]
            }
        }
    }
