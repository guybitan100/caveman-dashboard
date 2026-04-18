# Thread-Based Story Generation Architecture

## Overview

This document describes the new thread-based story generation architecture that replaces the monolithic story generation agent with specialized agents for different story types.

**Status**: ✅ **Implementation Complete** (December 10, 2025)

## Background

### Problem
The original story generation system used a single monolithic agent to generate all story types. This had several limitations:
- No awareness of related stories (email threads, chat conversations)
- Generated each story in isolation
- Inefficient for conversational story types
- Difficult to maintain and extend

### Solution
Break down story generation into **4 specialized agent types**, with thread-based generation for contextual story types (Email, Chat, SMS) that can generate multiple related stories as conversation threads.

## Architecture

### Agent Types

#### 1. **Email Thread Agent** (Two-Phase)
- **Location**: `ai_generator/agents/email_thread.py`
- **Phase 1**: Thread Planning Agent
  - Analyzes all planned email stories across events
  - Groups related emails into threads (same subject, participants)
  - Creates thread timeline with standalone and thread entries
  - Output: `EmailThreadPlans`
- **Phase 2**: Story Generation Agent
  - Generates email stories one-by-one from timeline entries
  - Maintains thread context for related emails
  - Output: `EmailStoryData`

#### 2. **Chat Thread Agent** (Two-Phase)
- **Location**: `ai_generator/agents/chat_thread.py`
- **Phase 1**: Thread Planning Agent
  - Groups chat messages by participants and timeframe
  - Creates conversation timeline
  - Output: `ChatThreadPlans`
- **Phase 2**: Messages Generation Agent
  - Generates chat messages in batches of 10
  - Maintains conversation flow and context
  - Output: `ChatStoryData`

#### 3. **SMS Thread Agent** (Two-Phase)
- **Location**: `ai_generator/agents/sms_thread.py`
- **Phase 1**: Thread Planning Agent
  - Groups SMS messages into conversations
  - Creates thread timeline
  - Output: `SMSThreadPlans`
- **Phase 2**: Story Generation Agent
  - Generates SMS messages with thread awareness
  - Output: `InstantMessageStoryData`

#### 4. **Simple Story Agent** (Single-Phase)
- **Location**: `ai_generator/agents/simple_story.py`
- Handles 13 story types:
  - Call, Location, Route, Image, Video, Audio
  - Document, Web History, Web Bookmark, Cookie
  - App, Contact, Power Event
- Generates stories directly without threading
- Creates specialized agent dynamically based on story type

### Multi-Phone Support

**Location**: `ai_generator/agents/multi_phone_utils.py`

Handles duplication of stories across multiple phones:
- **Email**: Changes Inbox/Sent folder, preserves content
- **Call**: Flips direction (Incoming ↔ Outgoing)
- **SMS**: Flips Sent/Read status
- **Chat**: Duplicates for all participants in conversation

**Key Functions**:
- `create_multi_phone_stories()` - Main entry point
- `get_involved_entities_from_story()` - Extracts participants
- Type-specific transformations for each story type

### Orchestration

**Location**: `ai_generator/orchestration.py`

Main orchestration function that coordinates all specialized agents:

```python
async def generate_stories_from_plan(
    plan: StoryGenerationPlan,
    timeline: list[TimelineEvent],
    entities: list[Entity],
) -> Dict[str, List[StoryData]]
```

**Flow**:
1. Group planned stories by type (email, chat, sms, other)
2. Generate email threads (plan → generate)
3. Generate chat threads (plan → generate)
4. Generate SMS threads (plan → generate)
5. Generate simple stories in parallel batches
6. Apply multi-phone transformations
7. Return stories organized by phone ID

## Data Models

**Location**: `ai_generator/models/thread_planning.py`

### Email Thread Models
```python
class EmailThreadPlan(BaseModel):
    thread_id: str
    subject: str
    participants: List[str]  # entity IDs
    timeline_entries: List[EmailTimelineEntry]

class EmailTimelineEntry(BaseModel):
    entry_id: str
    is_standalone: bool  # True = standalone, False = part of thread
    thread_id: Optional[str]
    from_entity_id: str
    to_entity_ids: List[str]
    timestamp: str
    subject: str
    event_context: str
    planned_story_id: str
    phone_entity_id: str
```

### Chat Thread Models
```python
class ChatThreadPlan(BaseModel):
    thread_id: str
    participants: List[str]
    timeline_entries: List[ChatTimelineEntry]

class ChatTimelineEntry(BaseModel):
    entry_id: str
    is_standalone: bool
    thread_id: Optional[str]
    participants: List[str]
    timestamp: str
    event_context: str
    planned_story_id: str
    phone_entity_id: str
    message_count: int  # Expected number of messages
```

### SMS Thread Models
```python
class SMSThreadPlan(BaseModel):
    thread_id: str
    participants: List[str]  # 2 participants (SMS is 1-to-1)
    timeline_entries: List[SMSTimelineEntry]

class SMSTimelineEntry(BaseModel):
    entry_id: str
    is_standalone: bool
    thread_id: Optional[str]
    from_entity_id: str
    to_entity_id: str
    timestamp: str
    event_context: str
    planned_story_id: str
    phone_entity_id: str
```

## Integration

### Pipeline Integration

**File**: `ai_generator/pipeline.py`

The `_run_story_generation()` method was simplified from ~130 lines to ~25 lines:

**Before** (old approach):
```python
# 1. Generate sync groups first
# 2. Generate individual stories in batches
# Complex logic for each story type
```

**After** (new approach):
```python
# Use new orchestration to generate all stories
phone_stories = await generate_stories_from_plan(
    plan=plan,
    timeline=timeline,
    entities=entities,
)
```

Media generation and phone mapping logic remain unchanged.

### Exports

**File**: `ai_generator/agents/__init__.py`

New exports added:
```python
# Phase 3 agents (thread-based specialized story generation)
"email_thread_planning_agent",
"email_story_generation_agent",
"chat_thread_planning_agent",
"chat_messages_generation_agent",
"sms_thread_planning_agent",
"sms_story_generation_agent",

# Phase 3 functions
"plan_email_threads",
"generate_email_story_from_thread",
"plan_chat_threads",
"generate_chat_from_thread",
"plan_sms_threads",
"generate_sms_story_from_thread",
"generate_simple_story",
"create_multi_phone_stories",
"get_involved_entities_from_story",
```

## Key Features

### 1. Hybrid Thread Discovery
- **Prefer** grouping related events into threads
- **Allow** standalone stories when appropriate
- **Allow** realistic expansions (e.g., email + reply)
- **NO** forced connections between unrelated events

### 2. Two-Phase Pattern for Threads
- **Phase 1**: Planning - understand all stories, create timeline
- **Phase 2**: Generation - generate stories one-by-one with context

### 3. Chat Batching
- Generate 10 messages at a time
- Maintain conversation flow
- Provide clear plan for next batch

### 4. Multi-Phone Efficiency
- Generate story once
- Programmatically duplicate/transform for other phones
- Type-specific transformations (swap sender/receiver, folder, status)

### 5. No Backward Compatibility
- Full migration to new architecture
- Old `story_generation.py` deprecated (can be removed)
- Old `prompts/story_generation.md` deprecated (can be removed)

## File Structure

```
ai_generator/
├── agents/
│   ├── email_thread.py          # Email thread agent (NEW)
│   ├── chat_thread.py           # Chat thread agent (NEW)
│   ├── sms_thread.py            # SMS thread agent (NEW)
│   ├── simple_story.py          # Simple story agent (NEW)
│   ├── multi_phone_utils.py     # Multi-phone utilities (NEW)
│   ├── story_generation.py      # Old monolithic agent (DEPRECATED)
│   ├── prompts/
│   │   ├── email_thread_planning.md      # (NEW)
│   │   ├── email_story_generation.md     # (NEW)
│   │   ├── chat_thread_planning.md       # (NEW)
│   │   ├── chat_messages_generation.md   # (NEW)
│   │   ├── sms_thread_planning.md        # (NEW)
│   │   ├── sms_story_generation.md       # (NEW)
│   │   ├── simple_story_generation.md    # (NEW)
│   │   └── story_generation.md           # (DEPRECATED)
│   └── __init__.py              # Updated exports
├── models/
│   ├── thread_planning.py       # Thread planning models (NEW)
│   ├── story_output.py          # Old models (can be removed)
│   └── __init__.py              # Updated exports
├── orchestration.py             # Main orchestration (NEW)
└── pipeline.py                  # Updated to use orchestration
```

## Testing Checklist

### Unit Tests Needed
- [ ] Email thread planning
- [ ] Email story generation
- [ ] Chat thread planning
- [ ] Chat messages generation
- [ ] SMS thread planning
- [ ] SMS story generation
- [ ] Simple story generation for each type
- [ ] Multi-phone transformations for each type

### Integration Tests Needed
- [ ] End-to-end email thread generation
- [ ] End-to-end chat thread generation
- [ ] End-to-end SMS thread generation
- [ ] Mixed story types in single plan
- [ ] Multi-phone story duplication

### Manual Testing Needed
- [ ] Generate job with email stories
- [ ] Generate job with chat stories
- [ ] Generate job with SMS stories
- [ ] Generate job with mix of all types
- [ ] Verify thread coherence
- [ ] Verify multi-phone correctness

## Migration Notes

### Deprecated Files (Can Be Removed)
1. `agents/story_generation.py` - Replaced by specialized agents
2. `agents/prompts/story_generation.md` - Replaced by specialized prompts
3. `models/story_output.py` - Replaced by thread planning models (if not used elsewhere)

### Breaking Changes
- None! The pipeline interface remains the same
- `_run_story_generation()` signature unchanged
- Input/output models unchanged

### Rollback Plan
If issues arise:
1. Revert changes to `pipeline.py` (restore old `_run_story_generation`)
2. Restore imports of `generate_story_from_plan` and `generate_stories_for_sync_group`
3. New files can remain (no conflicts)

## Future Enhancements

### Potential Improvements
1. **Thread continuity across events**: Allow threads to span multiple unrelated events when realistic
2. **Smarter thread detection**: Use NLP to detect topic similarity for threading
3. **Group chat support**: Enhance chat threading for group conversations
4. **Email CC/BCC**: Add support when model fields are uncommented
5. **Attachment threading**: Link related attachments across thread messages
6. **Performance optimization**: Cache entity lookups, parallel thread planning

### Monitoring
1. Track thread generation success rate
2. Monitor story generation latency by type
3. Track multi-phone transformation success
4. Log thread coherence issues

## Performance Characteristics

### Expected Improvements
- **Email threads**: 3-5x faster (fewer LLM calls)
- **Chat threads**: 2-3x faster (batched generation)
- **SMS threads**: 2-3x faster (thread-aware generation)
- **Simple stories**: Similar (no threading overhead)

### Batch Sizes
- **Email**: Process all thread plans at once, generate one-by-one
- **Chat**: Generate 10 messages per batch
- **SMS**: Process all thread plans at once, generate one-by-one
- **Simple**: Batch size 10 (configurable)

## Conclusion

The thread-based story generation architecture provides:
- ✅ **Better quality**: Thread-aware, contextual story generation
- ✅ **Better performance**: Fewer LLM calls through batching
- ✅ **Better maintainability**: Specialized agents, clear separation
- ✅ **Better scalability**: Easy to add new story types
- ✅ **Better multi-phone support**: Efficient duplication with transformations

All implementation is complete and ready for testing.

---

**Document Version**: 1.0  
**Last Updated**: December 10, 2025  
**Status**: Implementation Complete ✅
