# AI Story Generation Pipeline

An AI-powered system that generates realistic mobile phone extraction scenarios (UFDRs) from story descriptions using a sequential multi-agent pipeline with 8 stages.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Pipeline Stages](#pipeline-stages)
- [Agents](#agents)
- [Models](#models)
- [Services](#services)
- [Media Generation](#media-generation)
- [Storage](#storage)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Directory Structure](#directory-structure)
- [Troubleshooting](#troubleshooting)

## Overview

This service transforms a short story description into a complete set of GenerationJobs ready for phone extraction simulation. The pipeline uses AI (LLM) to generate realistic narratives, entities, relationships, timelines, and phone data artifacts.

### Complete Pipeline Flow

```
Short Story Description
        |
        v
+------------------+     +------------------+     +------------------+
| Stage 1:         | --> | Stage 2:         | --> | Stage 3:         |
| Story Expansion  |     | Entity Extraction|     | Social Graph     |
| (500-1000 words) |     | (Characters)     |     | (Relationships)  |
+------------------+     +------------------+     +------------------+
        |                                                 |
        v                                                 v
+------------------+     +------------------+     +------------------+
| Stage 4:         | --> | Stage 5:         | --> | Stage 6:         |
| Timeline Gen     |     | Phone Selection  |     | Story Planning   |
| (20-50 events)   |     | (2+ phones)      |     | (What to gen)    |
+------------------+     +------------------+     +------------------+
        |                                                 |
        v                                                 v
+------------------+     +------------------+     +------------------+
| Stage 7:         | --> | Stage 7.5:       | --> | Stage 8:         |
| Story Generation |     | Media Generation |     | Job Assembly     |
| (StoryData)      |     | (AWS Bedrock)    |     | (GenerationJob)  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                              +------------------+
                                              | Stage 9 (Opt):   |
                                              | UFDR Submission  |
                                              +------------------+
```

### Key Features

- **8-Stage Pipeline**: Complete flow from story description to GenerationJobs
- **Multi-Agent Architecture**: Each stage uses a specialized AI agent
- **Structured Output**: All agents return validated Pydantic models
- **Human-in-the-Loop (HITL)**: Optional review callbacks between stages
- **Media Generation**: Images, videos, audio via AWS Bedrock (Nova Canvas/Reel/Sonic)
- **Session Persistence**: All intermediate results saved as JSON for debugging and resumption
- **Sync Groups**: Coordinated story generation for bidirectional events (calls, messages)

---

## Architecture

### Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM Framework | PydanticAI | Agent orchestration with structured outputs |
| LLM Gateway | LiteLLM | Multi-provider gateway (Claude, GPT-4, etc.) |
| Validation | Pydantic v2 | Data validation and typed models |
| Media Gen | AWS Bedrock | Nova Canvas (images), Nova Reel (video), Nova Sonic (audio) |
| Storage | S3 | Generated media files |
| HTTP Client | httpx | Async HTTP for UFDR submission |
| Python | 3.13+ | Modern Python with type hints |

### Key Design Patterns

1. **Agent-Per-Stage**: Each pipeline stage has a dedicated agent with specific prompts and output schemas
2. **Structured Output**: Uses PydanticAI's `output_type` to ensure valid, typed responses
3. **Session-Based Storage**: Each pipeline run creates a unique session with numbered JSON outputs
4. **Lazy Initialization**: Agents created on-demand to avoid unnecessary LLM connections
5. **Sync Groups**: Stories that must match (both sides of a call) share a `sync_group_id`
6. **Error Recovery**: Timeline events have automatic LLM-based fix attempts for validation errors

---

## Pipeline Stages

### Stage 1: Story Expansion

**Agent**: `story_expansion_agent`  
**Input**: Short description (1-2 sentences)  
**Output**: `StoryExpansion` model

Expands a brief story description into a detailed 500-1000 word narrative suitable for generating realistic phone data.

```python
from ai_generator.agents import expand_story

story = await expand_story("A detective investigating a murder in a small town")
# Returns: StoryExpansion with expanded_narrative, setting, key_themes
```

**Output Fields**:
- `expanded_narrative`: Detailed story (500-1000 words)
- `setting`: Time period and location
- `key_themes`: List of story themes (e.g., crime, betrayal, redemption)

---

### Stage 2: Entity Extraction

**Agent**: `entity_extraction_agent`  
**Input**: `StoryExpansion`  
**Output**: `list[Entity]`

Extracts all characters from the narrative with detailed characteristics.

```python
from ai_generator.agents import extract_entities

entities = await extract_entities(story)
# Returns: List of Entity objects with characteristics
```

**Entity Fields**:
- `entity_id`: Unique identifier (e.g., "entity_001")
- `name`: Full name
- `role`: owner/suspect/victim/witness/family/friend/colleague/other
- `is_owner`: Whether this entity's phone will be extracted
- `phone_numbers`: List of phone numbers
- `emails`: List of email addresses
- `characteristics`: Age, gender, occupation, personality traits, tech savviness, social activity

---

### Stage 3: Social Graph

**Agent**: `social_graph_agent`  
**Input**: `StoryExpansion`, `list[Entity]`  
**Output**: `SocialGraph`

Builds a relationship network between all entities.

```python
from ai_generator.agents import build_social_graph

graph = await build_social_graph(story, entities)
# Returns: SocialGraph with relationships
```

**Relationship Fields**:
- `entity_id_1`, `entity_id_2`: Connected entities
- `relationship_type`: family/romantic/friend/colleague/acquaintance/business/adversarial/other
- `strength`: 1-10 scale
- `communication_frequency`: 1-10 scale (affects phone data density)
- `is_bidirectional`: Whether relationship is mutual

---

### Stage 4: Timeline Generation

**Agent**: `timeline_generation_agent`, `event_fix_agent`  
**Input**: `StoryExpansion`, `list[Entity]`, `SocialGraph`  
**Output**: `list[TimelineEvent]`

Creates a chronological timeline of 20-50 events with automatic error recovery.

```python
from ai_generator.agents import generate_timeline

timeline = await generate_timeline(story, entities, graph)
# Returns: List of TimelineEvent objects sorted by timestamp
```

**TimelineEvent Fields**:
- `event_id`: Unique identifier
- `timestamp`: ISO format datetime
- `category`: communication/location/media/social/financial/work/meeting/digital_activity/other
- `primary_entity`: Whose phone this event would appear on
- `involved_entities`: All entities involved
- `description`: What happened
- `location`: Where it happened
- `coordinates`: GPS coordinates (if applicable)
- `metadata`: Event-specific details (scalar values only)
- `significance`: 1-10 plot importance

**Error Recovery**: If an event fails validation, the `event_fix_agent` attempts to repair it up to 2 times.

---

### Stage 5: Phone Selection

**Agent**: `phone_selection_agent`  
**Input**: `list[Entity]`, `list[TimelineEvent]`, `SocialGraph`  
**Output**: `list[SelectedPhone]`

Analyzes entities and recommends which phones to extract. Auto-selects top 2 recommended phones.

```python
from ai_generator.agents import generate_phone_candidates, auto_select_recommended

candidates = await generate_phone_candidates(entities, timeline, graph)
selected = auto_select_recommended(candidates, max_phones=2)
```

**PhoneCandidate Fields**:
- `entity_id`, `entity_name`: Entity identification
- `total_event_count`: Timeline events involving this entity
- `primary_event_count`: Events where entity is primary
- `connection_count`: Number of relationships
- `recommended`: Whether AI recommends extraction
- `recommendation_reason`: Explanation

**SelectedPhone Fields**:
- `entity_id`, `entity_name`: Entity identification
- `device_type`: IPHONE/ANDROID/GENERIC
- `phone_number`, `email`: Contact info
- `start_date`, `end_date`: Extraction date range

---

### Stage 6: Story Planning

**Agent**: `story_planning_agent`  
**Input**: `list[SelectedPhone]`, `list[TimelineEvent]`, `list[Entity]`  
**Output**: `StoryGenerationPlan`

Plans which stories should be generated for each phone from each timeline event.

```python
from ai_generator.agents import plan_stories

plan = await plan_stories(timeline, selected_phones, entities)
# Returns: StoryGenerationPlan with event_plans
```

**PlannedStory Fields**:
- `phone_entity_id`: Which phone this story belongs to
- `story_type`: call/sms_mms/chat/email/location/image/video/audio/document/web_history/contact/app
- `perspective`: sender/receiver/creator/participant/observer
- `sync_group_id`: Links stories that must be coordinated
- `context`: Additional generation context (app_name, contact_entity_id, etc.)

**Sync Groups**: Stories with the same `sync_group_id` will have matching data (e.g., both sides of a phone call).

---

### Stage 7: Story Generation

**Agent**: `story_generation_agent`  
**Input**: `PlannedStory`, `TimelineEvent`, `list[Entity]`  
**Output**: `StoryData` (typed discriminated union)

Generates actual `StoryData` objects from planned stories.

```python
from ai_generator.agents import generate_story_from_plan, generate_stories_for_sync_group

# Single story
story = await generate_story_from_plan(planned_story, event, entities, session_id)

# Sync group (coordinated stories)
stories = await generate_stories_for_sync_group(sync_group_stories, entities, session_id)
```

**Supported Story Types**:

| Story Type | Pydantic Model | Key Fields |
|------------|----------------|------------|
| `call` | `CallStoryData` | participant, direction, duration, call_type |
| `sms/mms` | `InstantMessageStoryData` | sender, text, status, attachment |
| `chat message` | `ChatMessageStoryData` | chat_uid, sender, text, attachments |
| `chat` | `ChatStoryData` | app_id, participants, messages |
| `email` | `EmailStoryData` | from_, to, subject, body, folder |
| `location` | `LocationStoryData` | coordinate (lat/lon), category |
| `image` | `ImageStoryData` | file (s3_key, file_name, size), deleted_state |
| `video` | `VideoStoryData` | file (s3_key, file_name, size) |
| `audio` | `AudioStoryData` | file (s3_key, file_name, size) |
| `document` | `DocumentStoryData` | file (s3_key, file_name, size) |
| `web history` | `WebHistoryStoryData` | url, title, uses |
| `contact` | `ContactStoryData` | contact (first_name, phones, emails) |
| `app` | `AppStoryData` | app (app_id, name) |

**Placeholder References**: Stories can reference other stories using `@{type}_{id}` format:
- Location reference: `"location_ref": "@location_crime_scene"`
- Attachments: `"attachments": ["@document_report", "@image_photo"]`

---

### Stage 7.5: Media Generation

**Service**: `MediaGeneratorService`  
**Input**: `list[StoryData]` (file-based stories)  
**Output**: Updated stories with S3 paths

Generates actual media files for image/video/audio/document stories using AWS Bedrock.

```python
from ai_generator.services import MediaGeneratorService

media_service = MediaGeneratorService(job_id=session_id)
updated_stories = await media_service.generate_media_for_stories(stories, entity_map)
```

**Generators**:
| Generator | Model | Output |
|-----------|-------|--------|
| `ImageGenerator` | Nova Canvas | PNG images (1024x1024) |
| `VideoGenerator` | Nova Reel | MP4 videos (6 seconds, 1280x720) |
| `AudioGenerator` | Nova Sonic | MP3 audio |
| `DocumentGenerator` | (Custom) | PDF/DOCX/TXT |

**Features**:
- Batched generation with configurable concurrency
- Automatic retries with exponential backoff
- Failed stories are removed from the pipeline
- Generated files uploaded to S3

---

### Stage 8: Job Assembly

**Agent**: `JobAssemblyAgent` (non-LLM, deterministic)  
**Input**: `list[SelectedPhone]`, `list[PhoneStoryMapping]`, `list[Entity]`  
**Output**: `JobGenerationResult`

Assembles `GenerationJob` objects ready for the Titan generation service.

```python
from ai_generator.agents import JobAssemblyAgent

agent = JobAssemblyAgent()
result = agent.assemble_jobs(session_id, phones, story_mappings, entities)
# Returns: JobGenerationResult with generation_jobs list
```

**GenerationJob Contents**:
- `job_id`: Unique job identifier
- `name`: Human-readable job name
- `context`: DeviceContext (device_info, start_date, end_date)
- `owner_entity`: Phone owner as JobEntity
- `entities`: Other referenced entities
- `stories`: List of StoryData dicts (including auto-generated AppStoryData)

**App Story Generation**: Automatically creates `AppStoryData` for every `app_id` referenced in stories.

---

### Stage 9: UFDR Submission (Optional)

**Client**: `UFDRClient`  
**Input**: `list[GenerationJob]`  
**Output**: `list[UFDRSubmissionResponse]`

Submits jobs to the UFDR endpoint for processing.

```python
from ai_generator.services import UFDRClient

client = UFDRClient()
responses = await client.submit_jobs_batch(result.generation_jobs)
```

---

## Agents

All agents are located in `ai_generator/agents/` with corresponding prompts in `agents/prompts/`.

| Agent | File | Prompt File | Output Type | Uses LLM |
|-------|------|-------------|-------------|----------|
| Story Expansion | `story_expansion.py` | `story_expansion.md` | `StoryOutput` | Yes |
| Entity Extraction | `entity_extraction.py` | `entity_extraction.md` | `EntityOutput` | Yes |
| Social Graph | `social_graph.py` | `social_graph.md` | `SocialGraphOutput` | Yes |
| Timeline Generation | `timeline_generation.py` | `timeline_generation.md` | `TimelineOutput` | Yes |
| Event Fix | `timeline_generation.py` | `timeline_fix.md` | `FixedEventOutput` | Yes |
| Phone Selection | `phone_selection.py` | `phone_selection.md` | `PhoneCandidateOutput` | Yes |
| Story Planning | `story_planning.py` | `story_planning.md` | `PlanningOutput` | Yes |
| Story Generation | `story_generation.py` | `story_generation.md` | `Stories` | Yes |
| Job Assembly | `job_assembly.py` | N/A | `JobGenerationResult` | No |

### Agent Configuration

All LLM agents use the same model configuration via `get_model()`:

```python
from ai_generator.utils import get_model

model = get_model(model_name="claude-sonnet-4-5")  # Default
```

The model connects to LiteLLM proxy using `SETTINGS.LITELLM_BASE_URL` and `SETTINGS.LITELLM_API_KEY`.

---

## Models

All data models are in `ai_generator/models/` using Pydantic v2.

### Phase 1 Models (Story Generation)

| Model | File | Description |
|-------|------|-------------|
| `StoryExpansion` | `story.py` | Expanded narrative with setting and themes |
| `Entity` | `entity.py` | Character with characteristics |
| `EntityCharacteristics` | `entity.py` | Age, gender, occupation, traits |
| `Gender` | `entity.py` | Enum: male/female/other/unknown |
| `SocialGraph` | `social_graph.py` | Collection of relationships |
| `Relationship` | `social_graph.py` | Connection between two entities |
| `RelationshipType` | `social_graph.py` | Enum: family/romantic/friend/colleague/etc |
| `TimelineEvent` | `timeline.py` | Single event in the timeline |
| `EventCategory` | `timeline.py` | Enum: communication/location/media/etc |

### Phase 2 Models (Phone Extraction)

| Model | File | Description |
|-------|------|-------------|
| `DeviceType` | `phone_selection.py` | Enum: IPHONE/ANDROID/GENERIC |
| `PhoneCandidate` | `phone_selection.py` | Candidate phone with recommendation |
| `SelectedPhone` | `phone_selection.py` | Confirmed phone for extraction |
| `PhoneSelectionRequest` | `phone_selection.py` | Request for phone candidates |
| `PhoneSelectionResponse` | `phone_selection.py` | Response with candidates |
| `PhoneSelectionConfirmation` | `phone_selection.py` | Confirmed selections |
| `StoryPerspective` | `story_planning.py` | Enum: sender/receiver/creator/participant/observer |
| `PlannedStory` | `story_planning.py` | Single planned story |
| `EventStoryPlan` | `story_planning.py` | Stories for one timeline event |
| `StoryGenerationPlan` | `story_planning.py` | Complete plan for all events |
| `PhoneStoryMapping` | `phone_stories.py` | Stories mapped to a phone |
| `JobGenerationResult` | `phone_stories.py` | Final pipeline output |
| `UFDRJobSubmission` | `phone_stories.py` | UFDR submission tracking |

### Story Models (from model library)

The pipeline uses canonical `StoryData` models from `model.stories`:

```python
from model.stories import (
    StoryData,           # Discriminated union base
    CallStoryData,
    InstantMessageStoryData,
    EmailStoryData,
    ChatMessageStoryData,
    ChatStoryData,
    LocationStoryData,
    ImageStoryData,
    VideoStoryData,
    AudioStoryData,
    DocumentStoryData,
    WebHistoryStoryData,
    WebBookmarkStoryData,
    ContactStoryData,
    AppStoryData,
    PoweringEventStoryData,
    RouteStoryData,
    CookieStoryData,
)
```

### App Registry

The `AppRegistry` (`models/app_registry.py`) provides app metadata lookup:

```python
from ai_generator.models import get_app_registry, AppCategory, DeviceType

registry = get_app_registry()
app = registry.get_default_app(AppCategory.MESSAGING, DeviceType.IPHONE)
# Returns: AppInfo with app_id, display_name, etc.
```

---

## Services

All services are in `ai_generator/services/`.

### BedrockClient

Async AWS Bedrock client for media generation.

```python
from ai_generator.services import get_bedrock_client

client = get_bedrock_client()

# Image generation (sync)
result = await client.generate_image(
    prompt="A sunset over the ocean",
    width=1024,
    height=1024,
)

# Video generation (async with polling)
job_arn = await client.start_video_generation(
    prompt="A person walking on the beach",
    s3_output_uri="s3://bucket/prefix/",
)
status = await client.wait_for_video_generation(job_arn)

# Audio generation
result = await client.generate_audio(
    text="Hello, this is a test message",
    voice_id="matthew",
)
```

### S3Uploader

Handles S3 uploads for generated media.

```python
from ai_generator.services import get_s3_uploader

uploader = get_s3_uploader()
result = await uploader.upload(
    content=image_bytes,
    s3_key="uploads/session_id/story_uid.png",
)
```

### UFDRClient

HTTP client for UFDR job submission.

```python
from ai_generator.services import UFDRClient

client = UFDRClient(base_url="https://api.example.com")
response = await client.submit_job(generation_job)
```

### GeocodingService

AWS Location Service integration for geocoding.

```python
from ai_generator.services import get_geocoding_service

service = get_geocoding_service()
result = await service.geocode("New York City")
# Returns: GeocodingResult with coordinates
```

---

## Media Generation

### Overview

The `MediaGeneratorService` orchestrates media generation for file-based stories (image, video, audio, document).

### Configuration

Media generation is controlled via settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `MEDIA_GENERATION_ENABLED` | `true` | Enable/disable media generation |
| `MEDIA_GENERATION_BATCH_SIZE` | `3` | Concurrent generations (1-10) |
| `MEDIA_GENERATION_RETRY_ATTEMPTS` | `1` | Retries before removing story (0-3) |
| `VIDEO_GENERATION_POLL_INTERVAL` | `10` | Seconds between video status polls |
| `VIDEO_GENERATION_TIMEOUT` | `300` | Max seconds for video generation |

### AWS Bedrock Models

| Model | Service | Format |
|-------|---------|--------|
| `amazon.nova-canvas-v1:0` | Image | PNG, 1024x1024 |
| `amazon.nova-reel-v1:0` | Video | MP4, 1280x720, 6s |
| `amazon.nova-sonic-v1:0` | Audio | MP3 |

### Generator Flow

```
ImageStoryData ─────┬─────> ImageGenerator ──> BedrockClient.generate_image() ──> S3
VideoStoryData ─────┼─────> VideoGenerator ──> BedrockClient.start_video_generation() + poll ──> S3
AudioStoryData ─────┼─────> AudioGenerator ──> BedrockClient.generate_audio() ──> S3
DocumentStoryData ──┴─────> DocumentGenerator ──> (Custom PDF/DOCX gen) ──> S3
```

---

## Storage

### PipelineStorage

Session-based JSON storage for intermediate results.

```python
from ai_generator.storage import PipelineStorage

storage = PipelineStorage(base_path="./pipeline_sessions")

# Create session
session_id = storage.create_session()

# Save/load each stage
storage.save_story(session_id, story)
story = storage.load_story(session_id)

storage.save_entities(session_id, entities)
entities = storage.load_entities(session_id)

# ... similar for all stages
```

### Session Directory Structure

```
pipeline_sessions/
└── 20240115_143022/                    # Session ID (timestamp)
    ├── metadata.json                   # Session metadata
    ├── 1_story_expansion.json          # Stage 1 output
    ├── 2_entities.json                 # Stage 2 output
    ├── 3_social_graph.json             # Stage 3 output
    ├── 4_timeline.json                 # Stage 4 output
    ├── 5a_phone_selection_request.json # Stage 5 input
    ├── 5b_phone_selection_response.json# Stage 5 candidates
    ├── 5c_selected_phones.json         # Stage 5 confirmation
    ├── 6_story_plan.json               # Stage 6 output
    ├── 7_story_mappings.json           # Stage 7 output
    └── 8_generation_jobs.json          # Stage 8 output
```

### Session Metadata

```json
{
  "session_id": "20240115_143022",
  "created_at": "2024-01-15T14:30:22.123456",
  "last_updated": "2024-01-15T14:35:45.789012",
  "stages_completed": [
    "story_expansion",
    "entity_extraction",
    "social_graph",
    "timeline_generation",
    "phone_selection_confirmed",
    "story_planning",
    "story_mapping",
    "job_generation"
  ]
}
```

---

## Configuration

### Environment Variables

All settings use the `TITAN_` prefix and are defined in `settings.py`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TITAN_LITELLM_API_KEY` | Yes | - | API key for LiteLLM gateway |
| `TITAN_LITELLM_BASE_URL` | Yes | - | Base URL for LiteLLM gateway |
| `TITAN_MEDIA_GENERATION_ENABLED` | No | `true` | Enable media generation |
| `TITAN_MEDIA_GENERATION_BATCH_SIZE` | No | `3` | Concurrent media generations |
| `TITAN_MEDIA_GENERATION_RETRY_ATTEMPTS` | No | `1` | Retries before removing story |
| `TITAN_AWS_REGION` | No | `eu-central-1` | AWS region for general services |
| `TITAN_BEDROCK_REGION` | No | `us-east-1` | AWS region for Bedrock |
| `TITAN_BEDROCK_IMAGE_MODEL` | No | `amazon.nova-canvas-v1:0` | Image model ID |
| `TITAN_BEDROCK_VIDEO_MODEL` | No | `amazon.nova-reel-v1:0` | Video model ID |
| `TITAN_BEDROCK_AUDIO_MODEL` | No | `amazon.nova-sonic-v1:0` | Audio model ID |
| `TITAN_S3_TITAN_BUCKET_NAME` | No | - | S3 bucket for media |
| `TITAN_S3_UPLOADS_PREFIX` | No | `uploads` | S3 prefix for uploads |
| `TITAN_S3_GENERATED_MEDIA_PREFIX` | No | `generated-media` | S3 prefix for video output |
| `TITAN_VIDEO_GENERATION_POLL_INTERVAL` | No | `10` | Video polling interval (seconds) |
| `TITAN_VIDEO_GENERATION_TIMEOUT` | No | `300` | Video generation timeout (seconds) |

### Settings Access

```python
from ai_generator.settings import SETTINGS

api_key = SETTINGS.LITELLM_API_KEY.get_secret_value()
base_url = SETTINGS.LITELLM_BASE_URL
batch_size = SETTINGS.MEDIA_GENERATION_BATCH_SIZE
```

---

## Usage

### Command Line

```bash
# Basic usage
python -m ai_generator.main "A detective investigating a murder in a small town"

# With custom description
python -m ai_generator.main "A startup founder discovers their co-founder has been stealing company secrets"
```

### Python API - Full Pipeline

```python
from ai_generator.pipeline import Pipeline

# Create pipeline
pipeline = Pipeline()

# Run full pipeline with UFDR submission
session_id, result = await pipeline.run(
    description="A detective investigating a murder",
    submit_to_ufdr=True,
)

print(f"Session: {session_id}")
print(f"Stories: {result.total_stories_generated}")
print(f"Jobs: {result.total_jobs_created}")
print(f"UFDR submissions: {len(result.ufdr_submissions)}")
```

### Python API - Partial Pipeline

```python
# Run only to timeline (stages 1-4)
session_id, timeline = await pipeline.run_to_timeline(
    description="A detective investigating a murder"
)

print(f"Generated {len(timeline)} timeline events")
```

### Python API - With Review Callback

```python
def review_callback(stage_name: str, session_id: str) -> bool:
    """Review results and decide whether to continue."""
    print(f"Completed stage: {stage_name}")
    print(f"Session: {session_id}")
    
    # Load and review results
    if stage_name == "entity_extraction":
        entities = pipeline.storage.load_entities(session_id)
        print(f"Found {len(entities)} entities")
    
    return input("Continue? (y/n): ").lower() == 'y'

session_id, result = await pipeline.run(
    description="Your story here",
    review_callback=review_callback,
)
```

### Python API - Resume from Stage

```python
# Resume from a specific stage
result = await pipeline.resume(
    session_id="20240115_143022",
    from_stage="phone_selection",  # Options: phone_selection, story_planning, story_generation, job_assembly
)
```

### Python API - With Pre-selected Phones

```python
from ai_generator.models import SelectedPhone, DeviceType
from datetime import date

# Pre-select phones
phones = [
    SelectedPhone(
        entity_id="entity_001",
        entity_name="Detective Sarah",
        device_type=DeviceType.IPHONE,
        phone_number="+1-555-0123",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
    ),
    SelectedPhone(
        entity_id="entity_002",
        entity_name="Suspect John",
        device_type=DeviceType.ANDROID,
        phone_number="+1-555-0456",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
    ),
]

session_id, result = await pipeline.run(
    description="Your story here",
    phone_selections=phones,
)
```

### Get Session Summary

```python
summary = pipeline.get_summary(session_id)

print(f"Session: {summary.session_id}")
print(f"Stages completed: {summary.metadata.stages_completed}")
print(f"Story themes: {summary.outputs.story.themes if summary.outputs.story else 'N/A'}")
print(f"Entity count: {summary.outputs.entities.count if summary.outputs.entities else 'N/A'}")
print(f"Timeline events: {summary.outputs.timeline.events if summary.outputs.timeline else 'N/A'}")
print(f"Jobs created: {summary.outputs.jobs.count if summary.outputs.jobs else 'N/A'}")
```

---

## Testing

### Test Structure

```
tests/
├── test_pipeline.py              # Unit tests (mocked LLM)
├── test_integration.py           # Integration tests (real LLM)
├── test_e2e.py                   # E2E tests (5 predefined stories)
├── test_app_story_generation.py  # App story generation tests
├── test_full_pipeline_app_stories.py  # Full pipeline with apps
├── test_media_generators.py      # Media generation tests
├── test_ufdr_submission.py       # UFDR client tests
└── test_submit_existing.py       # Submit existing jobs tests
```

### Running Tests

```bash
# Install dependencies
poetry install

# Run unit tests (no API key needed)
poetry run pytest tests/test_pipeline.py -v

# Run integration tests (requires API key)
export TITAN_LITELLM_API_KEY="your-api-key"
export TITAN_LITELLM_BASE_URL="https://your-litellm-instance"
poetry run pytest tests/test_integration.py -v -s

# Run E2E tests (requires API key)
poetry run pytest tests/test_e2e.py -v -s

# Run all tests
poetry run pytest tests/ -v
```

### E2E Test Stories

The E2E tests include 5 predefined story scenarios:

1. **Detective Story**: Murder investigation in a small town
2. **Corporate Espionage**: Insider theft at a tech company
3. **Family Drama**: Inheritance dispute among siblings
4. **Startup Thriller**: Fraud discovery at a startup
5. **Romance Mystery**: Missing person case with romantic subplot

---

## Directory Structure

```
ai-generator/
├── ai_generator/
│   ├── agents/                     # LLM-powered agents
│   │   ├── prompts/               # Markdown prompt files
│   │   │   ├── story_expansion.md
│   │   │   ├── entity_extraction.md
│   │   │   ├── social_graph.md
│   │   │   ├── timeline_generation.md
│   │   │   ├── timeline_fix.md
│   │   │   ├── phone_selection.md
│   │   │   ├── story_planning.md
│   │   │   └── story_generation.md
│   │   ├── __init__.py            # Agent exports
│   │   ├── story_expansion.py     # Stage 1
│   │   ├── entity_extraction.py   # Stage 2
│   │   ├── social_graph.py        # Stage 3
│   │   ├── timeline_generation.py # Stage 4
│   │   ├── phone_selection.py     # Stage 5
│   │   ├── story_planning.py      # Stage 6
│   │   ├── story_generation.py    # Stage 7
│   │   └── job_assembly.py        # Stage 8
│   ├── generators/                 # Media generators
│   │   ├── __init__.py
│   │   ├── base.py                # Base class and types
│   │   ├── image_generator.py     # Nova Canvas
│   │   ├── video_generator.py     # Nova Reel
│   │   ├── audio_generator.py     # Nova Sonic
│   │   └── document_generator.py  # PDF/DOCX
│   ├── models/                     # Pydantic data models
│   │   ├── __init__.py            # Model exports
│   │   ├── story.py               # StoryExpansion
│   │   ├── entity.py              # Entity, EntityCharacteristics
│   │   ├── social_graph.py        # SocialGraph, Relationship
│   │   ├── timeline.py            # TimelineEvent, EventCategory
│   │   ├── phone_selection.py     # Phone selection models
│   │   ├── story_planning.py      # Story planning models
│   │   ├── phone_stories.py       # Story mapping and results
│   │   ├── story_output.py        # Output wrappers
│   │   └── app_registry.py        # App metadata registry
│   ├── services/                   # External service clients
│   │   ├── __init__.py            # Service exports
│   │   ├── bedrock_client.py      # AWS Bedrock
│   │   ├── s3_uploader.py         # S3 uploads
│   │   ├── ufdr_client.py         # UFDR submission
│   │   ├── geocoding.py           # AWS Location Service
│   │   └── media_generator_service.py  # Media orchestration
│   ├── __init__.py
│   ├── agent.py                   # Legacy public API
│   ├── main.py                    # CLI entry point
│   ├── pipeline.py                # Main pipeline orchestrator
│   ├── prompt_render.py           # Prompt rendering utilities
│   ├── settings.py                # Configuration
│   ├── storage.py                 # Session storage
│   └── utils.py                   # Utilities
├── tests/                          # Test files
├── pipeline_sessions/              # Generated session data
├── .env                            # Environment variables (gitignored)
├── Makefile                        # Common commands
├── poetry.lock
├── pyproject.toml
└── README.md                       # This file
```

---

## Troubleshooting

### Common Issues

#### Import Errors

```bash
# Install dependencies
poetry install

# Verify installation
poetry show pydantic-ai
```

#### LLM API Errors

```bash
# Verify credentials
echo $TITAN_LITELLM_API_KEY
echo $TITAN_LITELLM_BASE_URL

# Test connection
curl -H "Authorization: Bearer $TITAN_LITELLM_API_KEY" \
     $TITAN_LITELLM_BASE_URL/v1/models
```

#### Invalid JSON from LLM

The `output_type` parameter ensures valid JSON, but if issues occur:
- Check that the LLM model supports structured output
- Verify Pydantic schemas match expected output
- Check the `event_fix_agent` for timeline validation recovery

#### Timeline Event Validation Errors

Timeline events with invalid metadata (nested objects, lists) are automatically fixed:
1. `event_fix_agent` attempts to repair the event
2. Up to 2 retry attempts
3. Failed events are skipped with a warning

#### Media Generation Failures

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Check S3 bucket permissions
aws s3 ls s3://your-bucket-name/
```

#### Storage Errors

```bash
# Check directory permissions
ls -la pipeline_sessions/

# Clean up old sessions
rm -rf pipeline_sessions/session_*

# Create fresh directory
mkdir -p pipeline_sessions
```

#### UFDR Submission Failures

```bash
# Check UFDR endpoint
export UFDR_API_URL="https://your-ufdr-endpoint"
curl -X POST $UFDR_API_URL/UFDR/job \
     -H "Content-Type: application/json" \
     -d '{"job_id": "test"}'
```

### Debug Logging

Enable debug logging for more detail:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logging.getLogger("ai_generator").setLevel(logging.DEBUG)
```

### Pipeline Recovery

If a pipeline fails mid-execution:

```python
# Check session status
summary = pipeline.get_summary(session_id)
print(f"Completed stages: {summary.metadata.stages_completed}")

# Resume from the last completed stage
result = await pipeline.resume(
    session_id=session_id,
    from_stage="story_planning",  # Resume from here
)
```

---

## Contributing

When adding new features:

1. **New Agent**: Create in `agents/` with corresponding prompt in `agents/prompts/`
2. **New Model**: Add to `models/` and export in `models/__init__.py`
3. **New Service**: Add to `services/` and export in `services/__init__.py`
4. **Tests**: Add unit tests (mocked) and integration tests (real LLM)
5. **Documentation**: Update this README

### Code Style

- Use type hints throughout
- Follow existing Pydantic patterns
- Use `core.titan_logger.logger` for logging
- Async functions where appropriate


