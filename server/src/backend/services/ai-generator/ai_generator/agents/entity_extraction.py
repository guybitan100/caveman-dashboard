from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from ai_generator.models.entity import Entity
from ai_generator.prompt_render import render_story
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.models.story import StoryExpansion


class EntityOutput(BaseModel):
    """Output schema for entity extraction."""

    entities: list[Entity] = Field(
        description="List of entities with their characteristics"
    )


_PROMPT_PATH = Path(__file__).parent / "prompts" / "entity_extraction.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

entity_extraction_agent = Agent(
    name="entity_extraction_agent",
    model=get_model(),
    output_type=EntityOutput,
    instructions=_INSTRUCTIONS,
)


async def extract_entities(story: "StoryExpansion") -> list[Entity]:
    """Extract entities from an expanded story.

    Args:
        story: StoryExpansion containing the narrative to analyze

    Returns:
        List of Entity models with characteristics

    Raises:
        ValueError: If the agent fails to generate valid output
    """
    prompt = f"""{render_story(story)}

Extract all entities (characters) with their characteristics."""

    result = await entity_extraction_agent.run(prompt)
    return result.output.entities
