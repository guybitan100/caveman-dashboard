"""Story expansion agent - converts short description to detailed narrative."""

from __future__ import annotations

import logging
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from ai_generator.models.story import StoryExpansion
from ai_generator.utils import get_model

logger = logging.getLogger(__name__)


class StoryOutput(BaseModel):
    """Output schema for story expansion."""

    expanded_narrative: str = Field(
        description="The full detailed story (500-1000 words)"
    )
    setting: str = Field(
        description="Time period and location (e.g., 'Modern day, New York City')"
    )
    key_themes: list[str] = Field(
        description="Array of theme strings (e.g., ['crime', 'betrayal', 'redemption'])"
    )


# Load instructions from prompt file
_PROMPT_PATH = Path(__file__).parent / "prompts" / "story_expansion.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

story_expansion_agent = Agent(
    name="story_expansion_agent",
    model=get_model(),
    output_type=StoryOutput,
    instructions=_INSTRUCTIONS,
)


async def expand_story(short_description: str) -> StoryExpansion:
    """
    Expand a short description into a detailed story.

    Args:
        short_description: Brief story description from user

    Returns:
        StoryExpansion model with detailed narrative

    Raises:
        ValueError: If the agent fails to generate valid output
    """
    logger.info("Expanding story from description: %s...", short_description[:100])
    
    prompt = f'''Expand the following story description into a detailed narrative:

"{short_description}"'''

    try:
        result = await story_expansion_agent.run(prompt)
        
        story = StoryExpansion(
            original_description=short_description,
            expanded_narrative=result.output.expanded_narrative,
            setting=result.output.setting,
            key_themes=result.output.key_themes,
        )
        
        logger.info(
            "Story expansion complete - Setting: %s, Themes: %s, Length: %d words",
            story.setting,
            ", ".join(story.key_themes),
            len(story.expanded_narrative.split()),
        )
        
        return story
        
    except Exception as e:
        logger.error("Story expansion failed: %s", e, exc_info=True)
        raise ValueError(f"Failed to expand story: {e}") from e
