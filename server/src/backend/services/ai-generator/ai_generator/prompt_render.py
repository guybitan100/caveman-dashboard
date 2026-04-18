"""Prompt rendering utilities for formatting data structures into LLM-friendly text.

This module provides standardized functions for rendering Pydantic models
and other data structures into well-formatted text for inclusion in LLM prompts.

All rendering functions produce consistent, well-structured output with:
- Clear section headers with separators
- Proper indentation and spacing
- Bullet points for lists
- Compact or detailed views as needed

Example:
    ```python
    from ai_generator.prompt_render import render_story, render_entities
    
    prompt = f'''
    {render_story(story)}
    
    {render_entities(entities)}
    
    Now analyze this data...
    '''
    ```
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ai_generator.models.entity import Entity
    from ai_generator.models.social_graph import SocialGraph
    from ai_generator.models.story import StoryExpansion
    from ai_generator.models.timeline import TimelineEvent


def render_story(story: StoryExpansion) -> str:
    """
    Render a StoryExpansion for LLM prompt consumption.
    
    Args:
        story: StoryExpansion model
        
    Returns:
        Formatted string suitable for LLM prompts
        
    Example:
        STORY CONTEXT
        =============
        Setting: Modern day, New York City
        Themes: crime, betrayal, redemption
        
        NARRATIVE
        ---------
        [Full story text...]
    """
    themes = ", ".join(story.key_themes)
    
    return f"""STORY CONTEXT
=============
Setting: {story.setting}
Themes: {themes}

NARRATIVE
---------
{story.expanded_narrative}"""


def render_entities(entities: list[Entity], include_details: bool = True) -> str:
    """
    Render a list of entities for LLM prompt consumption.
    
    Args:
        entities: List of Entity models
        include_details: Whether to include detailed characteristics (default: True)
        
    Returns:
        Formatted string suitable for LLM prompts
        
    Example (include_details=True):
        ENTITIES (3 total)
        ==================
        
        • entity_001: Alice Johnson
          Role: protagonist
          Age: 28
          Occupation: Detective
          Phone: +1-555-0101
          Email: alice.johnson@nypd.gov
        
        • entity_002: Bob Smith
          Role: antagonist
          Age: 45
          Occupation: Crime Boss
          
    Example (include_details=False):
        ENTITIES (3 total)
        ==================
        • entity_001: Alice Johnson (Detective)
        • entity_002: Bob Smith (Crime Boss)
        • entity_003: Charlie Davis (Informant)
    """
    if not entities:
        return "ENTITIES\n==================\n(No entities provided)"
    
    lines = [
        f"ENTITIES ({len(entities)} total)",
        "==================",
        ""
    ]
    
    for entity in entities:
        if include_details:
            # Detailed format
            lines.append(f"• {entity.entity_id}: {entity.name}")
            
            if entity.characteristics.age:
                lines.append(f"  Age: {entity.characteristics.age}")
            if entity.characteristics.occupation:
                lines.append(f"  Occupation: {entity.characteristics.occupation}")
            if entity.phone_numbers:
                lines.append(f"  Phone: {', '.join(entity.phone_numbers)}")
            if entity.emails:
                lines.append(f"  Email: {', '.join(entity.emails)}")
            if entity.characteristics.personality_traits:
                traits = ", ".join(entity.characteristics.personality_traits)
                lines.append(f"  Traits: {traits}")
                
            lines.append("")  # Blank line between entities
        else:
            # Compact format
            occupation = entity.characteristics.occupation or "N/A"
            lines.append(f"• {entity.entity_id}: {entity.name} ({occupation})")
    
    return "\n".join(lines)


def render_social_graph(graph: SocialGraph) -> str:
    """
    Render a SocialGraph for LLM prompt consumption.
    
    Args:
        graph: SocialGraph model
        
    Returns:
        Formatted string suitable for LLM prompts
        
    Example:
        SOCIAL GRAPH (5 relationships)
        ===============================
        
        • entity_001 → entity_002
          Type: professional
          Description: Alice is investigating Bob's criminal organization
          Strength: 0.8
          
        • entity_002 → entity_003
          Type: criminal
          Description: Bob employs Charlie as an informant
          Strength: 0.6
    """
    if not graph.relationships:
        return "SOCIAL GRAPH\n===============================\n(No relationships)"
    
    lines = [
        f"SOCIAL GRAPH ({len(graph.relationships)} relationships)",
        "===============================",
        ""
    ]
    
    for rel in graph.relationships:
        lines.append(f"• {rel.entity_id_1} → {rel.entity_id_2}")
        lines.append(f"  Type: {rel.relationship_type}")
        if rel.description:
            lines.append(f"  Description: {rel.description}")
        if rel.strength is not None:
            lines.append(f"  Strength: {rel.strength}")
        lines.append("")
    
    return "\n".join(lines)


def render_timeline(
    events: list[TimelineEvent],
    max_events: int | None = None,
    include_metadata: bool = False
) -> str:
    """
    Render timeline events for LLM prompt consumption.
    
    Args:
        events: List of TimelineEvent models
        max_events: Maximum number of events to render (for truncation)
        include_metadata: Whether to include event metadata (default: False)
        
    Returns:
        Formatted string suitable for LLM prompts
        
    Example:
        TIMELINE (15 events)
        ====================
        
        [2024-01-01 09:00] Alice arrives at crime scene
          Participants: entity_001
          Location: 123 Main St
          
        [2024-01-01 10:30] Bob receives tip about investigation
          Participants: entity_002, entity_003
          Location: Warehouse District
    """
    if not events:
        return "TIMELINE\n====================\n(No events)"
    
    # Sort by timestamp
    sorted_events = sorted(events, key=lambda e: e.timestamp)
    
    # Truncate if needed
    display_events = sorted_events[:max_events] if max_events else sorted_events
    truncated = len(sorted_events) > len(display_events) if max_events else False
    
    lines = [
        f"TIMELINE ({len(sorted_events)} events{' - showing first ' + str(max_events) if truncated else ''})",
        "====================",
        ""
    ]
    
    for event in display_events:
        # Format timestamp
        timestamp_str = event.timestamp.strftime("%Y-%m-%d %H:%M")
        
        lines.append(f"[{timestamp_str}] {event.description}")
        
        if event.involved_entities:
            entities_str = ", ".join(event.involved_entities)
            lines.append(f"  Participants: {entities_str}")
        
        if event.location:
            lines.append(f"  Location: {event.location}")
        
        if include_metadata and event.metadata:
            # Render metadata as key-value pairs
            for key, value in event.metadata.items():
                lines.append(f"  {key}: {value}")
        
        lines.append("")
    
    if truncated:
        lines.append(f"... and {len(sorted_events) - len(display_events)} more events")
    
    return "\n".join(lines)


def render_entity_summary(entities: list[Entity]) -> str:
    """
    Render a compact entity summary (one line per entity).
    
    Args:
        entities: List of Entity models
        
    Returns:
        Compact formatted string
        
    Example:
        • entity_001: Alice Johnson - Detective
        • entity_002: Bob Smith - Crime Boss
        • entity_003: Charlie Davis - Informant
    """
    if not entities:
        return "(No entities)"
    
    lines = []
    for entity in entities:
        occupation = entity.characteristics.occupation or "N/A"
        lines.append(f"• {entity.entity_id}: {entity.name} - {occupation}")
    
    return "\n".join(lines)


def render_dict_section(
    title: str,
    data: dict[str, Any],
    indent: int = 0
) -> str:
    """
    Render a dictionary as a formatted section.
    
    Args:
        title: Section title
        data: Dictionary to render
        indent: Number of spaces to indent (default: 0)
        
    Returns:
        Formatted string
        
    Example:
        METADATA
        --------
        app_id: com.instagram.android
        action: post_created
        visibility: public
    """
    if not data:
        return f"{title}\n{'-' * len(title)}\n(No data)"
    
    indent_str = " " * indent
    title_line = f"{indent_str}{title}"
    separator = f"{indent_str}{'-' * len(title)}"
    
    lines = [title_line, separator]
    
    for key, value in data.items():
        lines.append(f"{indent_str}{key}: {value}")
    
    return "\n".join(lines)


def render_list_section(
    title: str,
    items: list[str],
    indent: int = 0
) -> str:
    """
    Render a list as a formatted section.
    
    Args:
        title: Section title
        items: List of items to render
        indent: Number of spaces to indent (default: 0)
        
    Returns:
        Formatted string
        
    Example:
        THEMES
        ------
        • crime
        • betrayal
        • redemption
    """
    if not items:
        return f"{title}\n{'-' * len(title)}\n(No items)"
    
    indent_str = " " * indent
    title_line = f"{indent_str}{title}"
    separator = f"{indent_str}{'-' * len(title)}"
    
    lines = [title_line, separator]
    
    for item in items:
        lines.append(f"{indent_str}• {item}")
    
    return "\n".join(lines)


def render_phone_event_context(
    phone_entity_id: str,
    phone_entity_name: str,
    event: TimelineEvent,
    entities: list[Entity],
) -> str:
    """
    Render an event from a specific phone's perspective.
    
    Args:
        phone_entity_id: ID of the phone owner
        phone_entity_name: Name of the phone owner
        event: Timeline event
        entities: All entities (for name lookups)
        
    Returns:
        Formatted string showing event from phone owner's perspective
        
    Example:
        EVENT FROM ALICE'S PERSPECTIVE
        ==============================
        Time: 2024-01-01 09:00
        What happened: Alice arrives at crime scene
        
        Alice's involvement: Primary participant
        Other participants: Bob Smith, Charlie Davis
        Location: 123 Main St
    """
    entity_map = {e.entity_id: e.name for e in entities}
    
    # Determine phone owner's involvement
    is_participant = phone_entity_id in event.involved_entities
    
    # Get other participants
    other_participants = [
        entity_map.get(eid, eid)
        for eid in event.involved_entities
        if eid != phone_entity_id
    ]
    
    lines = [
        f"EVENT FROM {phone_entity_name.upper()}'S PERSPECTIVE",
        "=" * (len(phone_entity_name) + 25),
        f"Time: {event.timestamp.strftime('%Y-%m-%d %H:%M')}",
        f"What happened: {event.description}",
        ""
    ]
    
    if is_participant:
        lines.append(f"{phone_entity_name}'s involvement: Primary participant")
    else:
        lines.append(f"{phone_entity_name}'s involvement: Observer/indirect")
    
    if other_participants:
        lines.append(f"Other participants: {', '.join(other_participants)}")
    
    if event.location:
        lines.append(f"Location: {event.location}")
    
    return "\n".join(lines)


# Convenience function for common prompt pattern
def render_story_context(
    story: StoryExpansion,
    entities: list[Entity],
    graph: SocialGraph | None = None,
    timeline: list[TimelineEvent] | None = None,
) -> str:
    """
    Render complete story context (story + entities + optional graph/timeline).
    
    Args:
        story: StoryExpansion model
        entities: List of Entity models
        graph: Optional SocialGraph model
        timeline: Optional list of TimelineEvent models
        
    Returns:
        Complete formatted context string
        
    Example:
        STORY CONTEXT
        =============
        ...
        
        ENTITIES (3 total)
        ==================
        ...
        
        SOCIAL GRAPH (5 relationships)
        ===============================
        ...
    """
    sections = [render_story(story), "", render_entities(entities)]
    
    if graph:
        sections.extend(["", render_social_graph(graph)])
    
    if timeline:
        sections.extend(["", render_timeline(timeline, max_events=20)])
    
    return "\n".join(sections)


def render_phone_candidates_context(
    entities: list[Entity],
    timeline: list[TimelineEvent],
    graph: SocialGraph | None = None,
) -> str:
    """
    Render context for phone candidate selection.
    
    Includes:
    - Entity summaries with phone status
    - Timeline event participation counts
    - Relationship context if available
    
    Args:
        entities: List of all entities
        timeline: List of timeline events
        graph: Optional social graph
        
    Returns:
        Formatted context string for phone selection prompt
        
    Example:
        ENTITIES FOR PHONE SELECTION
        =============================
        • entity_001: Alice Johnson (Detective) [HAS PHONE]
          Events: 15 total, 12 primary
          
        • entity_002: Bob Smith (Crime Boss)
          Events: 8 total, 3 primary
    """
    # Count entity participation in events
    entity_counts: dict[str, dict[str, int]] = {}
    
    for event in timeline:
        for entity_id in event.involved_entities:
            if entity_id not in entity_counts:
                entity_counts[entity_id] = {"total": 0, "primary": 0}
            entity_counts[entity_id]["total"] += 1
            if entity_id == event.primary_entity:
                entity_counts[entity_id]["primary"] += 1
    
    # Build entity summaries
    lines = [
        "ENTITIES FOR PHONE SELECTION",
        "=" * 29,
    ]
    
    for entity in entities:
        occupation = ""
        if entity.characteristics and entity.characteristics.occupation:
            occupation = f" ({entity.characteristics.occupation})"
        
        has_phone = " [HAS PHONE]" if entity.phone_numbers else ""
        
        counts = entity_counts.get(entity.entity_id, {"total": 0, "primary": 0})
        
        lines.extend([
            f"• {entity.entity_id}: {entity.name}{occupation}{has_phone}",
            f"  Events: {counts['total']} total, {counts['primary']} primary",
        ])
        
        # Add relationship context if available
        if graph:
            entity_rels = [
                r for r in graph.relationships
                if r.entity_id_1 == entity.entity_id or r.entity_id_2 == entity.entity_id
            ]
            if entity_rels:
                lines.append(f"  Relationships: {len(entity_rels)} connections")
        
        lines.append("")
    
    return "\n".join(lines)
