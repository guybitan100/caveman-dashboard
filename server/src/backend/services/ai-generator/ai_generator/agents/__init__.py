"""AI agents for the story generation pipeline."""

# Phase 1: Story generation agents
from ai_generator.agents.story_expansion import (
    story_expansion_agent,
    expand_story,
    StoryOutput,
)
from ai_generator.agents.entity_extraction import (
    entity_extraction_agent,
    extract_entities,
    EntityOutput,
)
from ai_generator.agents.social_graph import (
    social_graph_agent,
    build_social_graph,
    SocialGraphOutput,
)
from ai_generator.agents.timeline_generation import (
    timeline_generation_agent,
    event_fix_agent,
    generate_timeline,
    TimelineOutput,
    FixedEventOutput,
)

# Phase 2: Phone extraction agents (new 2-phase approach)
from ai_generator.agents.phone_selection import (
    phone_selection_agent,
    generate_phone_candidates,
    auto_select_recommended,
    PhoneCandidateOutput,
)
from ai_generator.agents.story_planning import (
    story_planning_agent,
    plan_stories,
    incorporate_validation_feedback,
    PlanningOutput,
)
from ai_generator.agents.story_validation import (
    story_validation_agent,
    validate_story_plan,
    ValidationOutput,
)

from ai_generator.agents.job_assembly import JobAssemblyAgent

# Phase 3: Specialized story generation agents (new thread-based approach)
from ai_generator.agents.email_thread import (
    email_thread_planning_agent,
    email_story_generation_agent,
    plan_email_threads,
    generate_email_story_from_thread,
)
from ai_generator.agents.chat_thread import (
    chat_thread_planning_agent,
    chat_messages_generation_agent,
    plan_chat_threads,
    generate_chat_from_thread,
)
from ai_generator.agents.sms_thread import (
    sms_thread_planning_agent,
    sms_story_generation_agent,
    plan_sms_threads,
    generate_sms_story_from_thread,
)
from ai_generator.agents.simple_story import (
    generate_simple_story,
)
from ai_generator.agents.multi_phone_utils import (
    create_multi_phone_stories,
    get_involved_entities_from_story,
)

__all__ = [
    # Phase 1 agents
    "story_expansion_agent",
    "entity_extraction_agent",
    "social_graph_agent",
    "timeline_generation_agent",
    "event_fix_agent",
    # Phase 1 functions
    "expand_story",
    "extract_entities",
    "build_social_graph",
    "generate_timeline",
    # Phase 1 output schemas
    "StoryOutput",
    "EntityOutput",
    "SocialGraphOutput",
    "TimelineOutput",
    "FixedEventOutput",
    # Phase 2 agents (new 2-phase approach)
    "phone_selection_agent",
    "story_planning_agent",
    "story_validation_agent",
    # Phase 2 functions (new 2-phase approach)
    "generate_phone_candidates",
    "auto_select_recommended",
    "plan_stories",
    "incorporate_validation_feedback",
    "validate_story_plan",
    # Phase 2 output schemas (new 2-phase approach)
    "PhoneCandidateOutput",
    "PlanningOutput",
    "ValidationOutput",
    # Non-LLM agents (kept as classes)
    "JobAssemblyAgent",
    # Phase 3 agents (thread-based specialized story generation)
    "email_thread_planning_agent",
    "email_story_generation_agent",
    "chat_thread_planning_agent",
    "chat_messages_generation_agent",
    "sms_thread_planning_agent",
    "sms_story_generation_agent",
    # Phase 3 functions (thread-based specialized story generation)
    "plan_email_threads",
    "generate_email_story_from_thread",
    "plan_chat_threads",
    "generate_chat_from_thread",
    "plan_sms_threads",
    "generate_sms_story_from_thread",
    "generate_simple_story",
    "create_multi_phone_stories",
    "get_involved_entities_from_story",
]
