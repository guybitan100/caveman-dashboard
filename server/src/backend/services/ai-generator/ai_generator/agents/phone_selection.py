"""Phone selection agent - prepares candidates and recommends phone extractions."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from core.six_logger import logger

from ai_generator.models import (
    Entity,
    SocialGraph,
    TimelineEvent,
    PhoneCandidate,
)
from ai_generator.utils import get_model

if TYPE_CHECKING:
    from ai_generator.prompt_render import render_phone_candidates_context


class RawPhoneCandidate(BaseModel):
    """
    LLM-friendly output schema for a phone candidate.
    
    Mirrors PhoneCandidate but with simpler validation for LLM output.
    """
    
    entity_id: str = Field(description="Entity ID from the entity extraction stage")
    entity_name: str = Field(description="Full name of the entity")
    total_event_count: int = Field(
        default=0,
        description="Total timeline events this entity appears in"
    )
    primary_event_count: int = Field(
        default=0,
        description="Events where this entity is the primary actor"
    )
    connection_count: int = Field(
        default=0,
        description="Number of other entities this entity is connected to"
    )
    recommended: bool = Field(
        default=False,
        description="Whether AI recommends this entity for extraction"
    )
    recommendation_reason: str | None = Field(
        default=None,
        description="Explanation for why this entity is or isn't recommended"
    )
    
    def to_phone_candidate(self) -> PhoneCandidate:
        """Convert to PhoneCandidate model."""
        return PhoneCandidate(
            entity_id=self.entity_id,
            entity_name=self.entity_name,
            total_event_count=self.total_event_count,
            primary_event_count=self.primary_event_count,
            connection_count=self.connection_count,
            recommended=self.recommended,
            recommendation_reason=self.recommendation_reason,
        )


class PhoneCandidateOutput(BaseModel):
    """Output schema for phone candidate generation."""

    candidates: list[RawPhoneCandidate] = Field(
        description="List of phone candidates with recommendation info"
    )


# Load instructions from prompt file
_PROMPT_PATH = Path(__file__).parent / "prompts" / "phone_selection.md"
_INSTRUCTIONS = _PROMPT_PATH.read_text()

phone_selection_agent = Agent(
    name="phone_selection_agent",
    model=get_model(),
    output_type=PhoneCandidateOutput,
    instructions=_INSTRUCTIONS,
)


async def generate_phone_candidates(
    entities: list[Entity],
    timeline: list[TimelineEvent],
    social_graph: SocialGraph | None = None,
) -> list[PhoneCandidate]:
    """
    Generate phone candidates with recommendations.

    Args:
        entities: List of entities from the story
        timeline: List of timeline events
        social_graph: Optional social graph for relationship context

    Returns:
        List of PhoneCandidate models with recommendations

    Raises:
        ValueError: If the agent fails to generate valid output
    """
    logger.info(
        "Generating phone candidates",
        entity_count=len(entities),
        timeline_event_count=len(timeline),
    )

    # Import here to avoid circular dependency issues
    from ai_generator.prompt_render import render_phone_candidates_context

    # Use centralized rendering for context
    context = render_phone_candidates_context(entities, timeline, social_graph)

    # Build timeline summary (condensed view)
    event_summaries = []
    for event in timeline[:30]:  # Show first 30 events
        event_line = f"- {event.timestamp}: {event.description[:80]} (Category: {event.category})"
        if event.involved_entities:
            event_line += f" - Entities: {', '.join(event.involved_entities)}"
        event_summaries.append(event_line)

    if len(timeline) > 30:
        event_summaries.append(f"... ({len(timeline) - 30} more events)")

    # Build relationship summary
    relationship_summary = ""
    if social_graph:
        relationship_lines = []
        for rel in social_graph.relationships[:20]:  # Limit to avoid token overflow
            relationship_lines.append(
                f"- {rel.entity_id_1} <-> {rel.entity_id_2}: {rel.relationship_type}"
            )
        if len(social_graph.relationships) > 20:
            relationship_lines.append(
                f"... ({len(social_graph.relationships) - 20} more relationships)"
            )
        relationship_summary = "\n".join(relationship_lines)

    prompt = f"""Analyze the following entities and their involvement in events to recommend phone extractions.

{context}

TIMELINE EVENTS ({len(timeline)} total):
{chr(10).join(event_summaries)}

{"RELATIONSHIPS:" + chr(10) + relationship_summary if relationship_summary else ""}

Analyze each entity and provide phone extraction recommendations."""

    try:
        logger.debug("Sending phone selection request to LLM")
        result = await phone_selection_agent.run(prompt)

        # Convert to PhoneCandidate models
        candidates: list[PhoneCandidate] = []
        for raw_candidate in result.output.candidates:
            # Find matching entity for additional context if needed
            entity = next(
                (e for e in entities if e.entity_id == raw_candidate.entity_id),
                None,
            )
            
            # Use entity name from entity if not provided by LLM
            if not raw_candidate.entity_name and entity:
                raw_candidate.entity_name = entity.name
            
            candidates.append(raw_candidate.to_phone_candidate())

        recommended_count = sum(1 for c in candidates if c.recommended)
        logger.info(
            "Phone candidate generation complete",
            total_candidates=len(candidates),
            recommended_count=recommended_count,
        )

        if recommended_count > 0:
            top_candidates = [c for c in candidates if c.recommended][:3]
            logger.info(
                "Top recommended candidates",
                candidates=[f"{c.entity_name} ({c.primary_event_count} primary events)" for c in top_candidates],
            )

        return candidates

    except Exception as e:
        logger.error("Phone candidate generation failed", error=str(e))
        raise ValueError(f"Failed to generate phone candidates: {e}") from e


def auto_select_recommended(
    candidates: list[PhoneCandidate],
    max_phones: int = 3,
) -> list[PhoneCandidate]:
    """
    Auto-select recommended phones up to a maximum count.

    Useful for automated pipelines that don't require HITL.

    Args:
        candidates: List of phone candidates
        max_phones: Maximum number of phones to select

    Returns:
        List of selected PhoneCandidate models
    """
    logger.info(
        "Auto-selecting phones",
        max_phones=max_phones,
        total_candidates=len(candidates),
    )

    recommended = [c for c in candidates if c.recommended]

    # Sort by event count (more events = more interesting)
    recommended.sort(
        key=lambda c: (c.primary_event_count, c.total_event_count),
        reverse=True,
    )

    selected = recommended[:max_phones]

    logger.info(
        "Auto-selected phones",
        count=len(selected),
        phones=[c.entity_name for c in selected],
    )

    return selected
