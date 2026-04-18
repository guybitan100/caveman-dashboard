"""
Main entry point for AI story generation system.

This module provides the orchestrator and agents for generating
UFDR simulation data from story descriptions.
"""

from ai_generator.orchestrator import PipelineOrchestrator
from ai_generator.storage import PipelineStorage
from ai_generator.agents import (
    story_expansion_agent,
    entity_extraction_agent,
    social_graph_agent,
    timeline_generation_agent,
    expand_story,
    extract_entities,
    build_social_graph,
    generate_timeline,
)

__all__ = [
    "PipelineOrchestrator",
    "PipelineStorage",
    # Agent instances
    "story_expansion_agent",
    "entity_extraction_agent",
    "social_graph_agent",
    "timeline_generation_agent",
    # Agent functions
    "expand_story",
    "extract_entities",
    "build_social_graph",
    "generate_timeline",
]


# Create default orchestrator instance
def create_orchestrator(storage_path: str = "./pipeline_sessions") -> PipelineOrchestrator:
    """
    Create a pipeline orchestrator with default configuration.
    
    Args:
        storage_path: Path to store pipeline sessions
        
    Returns:
        Configured PipelineOrchestrator
    """
    storage = PipelineStorage(storage_path)
    return PipelineOrchestrator(storage=storage)