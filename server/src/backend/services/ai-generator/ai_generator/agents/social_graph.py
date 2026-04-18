"""Social graph agent - builds relationship network between entities."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from ai_generator.models.social_graph import Relationship, SocialGraph
from ai_generator.prompt_render import render_entity_summary, render_story
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.models.entity import Entity
    from ai_generator.models.story import StoryExpansion


class SocialGraphOutput(BaseModel):
    """Output schema for social graph."""

    relationships: list[Relationship] = Field(
        description="List of relationships between entities"
    )


# Load instructions from prompt file
_PROMPT_PATH = Path(__file__).parent / "prompts" / "social_graph.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

social_graph_agent = Agent(
    name="social_graph_agent",
    model=get_model(),
    output_type=SocialGraphOutput,
    instructions=_INSTRUCTIONS,
)


async def build_social_graph(
    story: StoryExpansion,
    entities: list[Entity],
) -> SocialGraph:
    """Build a social graph from story and entities.

    Args:
        story: StoryExpansion containing the narrative
        entities: List of Entity models extracted from the story

    Returns:
        SocialGraph model with all relationships

    Raises:
        ValueError: If the agent fails to generate valid output
    """
    prompt = f"""{render_story(story)}

{render_entity_summary(entities)}

Map all meaningful relationships between these entities."""

    result = await social_graph_agent.run(prompt)

    return SocialGraph(relationships=result.output.relationships)
