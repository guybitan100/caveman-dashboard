from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_generator.agents import (
    expand_story,
    extract_entities,
    generate_phone_candidates,
    generate_timeline,
    social_graph_agent,
)
from ai_generator.models import (
    Entity,
    PhoneSelectionResponse,
    SelectedPhone,
    SocialGraph,
    StoryExpansion,
    TimelineEvent,
    story,
)
from ai_generator.models.phone_stories import JobGenerationResult
from ai_generator.pipeline import Pipeline
from ai_generator.prompt_render import render_entity_summary, render_story

app = FastAPI(name="Six AI Generation API")

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# == Deps ==


async def get_pipeline() -> Pipeline:
    return Pipeline()


# == Schemas ==


class StoryExpansionRequest(BaseModel):
    description: str = Field(description="Brief story description from user")


class EntityExtractionRequest(BaseModel):
    story: StoryExpansion


class SocialGraphRequest(BaseModel):
    story: StoryExpansion
    entities: list[Entity]


class TimelineGenerationRequest(BaseModel):
    story: StoryExpansion
    entities: list[Entity]
    social_graph: SocialGraph


class PhoneSelectionRequest(BaseModel):
    entities: list[Entity]
    timeline: list[TimelineEvent]
    social_graph: SocialGraph


class StoryGenerationRequest(BaseModel):
    selected_phones: list[SelectedPhone]
    timeline: list[TimelineEvent]
    entities: list[Entity]


class SubmitJobRequest(BaseModel):
    generation_result: JobGenerationResult


# == Endpoints ==


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "OK!"}


@app.post("/pipeline/1/story-expansion")
async def story_expansion(request: StoryExpansionRequest) -> StoryExpansion:
    return await expand_story(request.description)


@app.post("/pipeline/2/entity-extraction")
async def entity_extraction(request: EntityExtractionRequest) -> list[Entity]:
    return await extract_entities(request.story)


@app.post("/pipeline/3/social-graph")
async def social_graph(request: SocialGraphRequest) -> SocialGraph:
    prompt = f"""{render_story(request.story)}

{render_entity_summary(request.entities)}

Map all meaningful relationships between these entities."""

    result = await social_graph_agent.run(prompt)

    return SocialGraph(relationships=result.output.relationships)


@app.post("/pipeline/4/timeline-generation")
async def timeline_generation(
    request: TimelineGenerationRequest,
) -> list[TimelineEvent]:
    return await generate_timeline(
        request.story,
        request.entities,
        request.social_graph,
    )


@app.post("/pipeline/5/phone-selection")
async def phone_selection(
    request: PhoneSelectionRequest,
    pipeline: Pipeline = Depends(get_pipeline),
) -> list[SelectedPhone]:
    candidates = await generate_phone_candidates(
        request.entities,
        request.timeline,
        request.social_graph,
    )

    response = PhoneSelectionResponse(session_id="TODO", candidates=candidates)

    selected = pipeline._auto_select_phones(
        response,
        request.entities,
        request.timeline,
    )

    return selected


@app.post("/pipeline/6/story-generation")
async def story_generation(
    request: StoryGenerationRequest,
    pipeline: Pipeline = Depends(get_pipeline),
) -> JobGenerationResult:
    # Planning
    plan = await pipeline._run_story_planning(
        session_id="TODO",
        selected_phones=request.selected_phones,
        timeline=request.timeline,
        entities=request.entities,
    )

    # Generation
    story_mappings = await pipeline._run_story_generation(
        session_id="TODO",
        selected_phones=request.selected_phones,
        entities=request.entities,
        timeline=request.timeline,
        plan=plan,
    )

    # Job assembler
    result = pipeline._run_job_assembly(
        session_id="TODO",
        selected_phones=request.selected_phones,
        story_mappings=story_mappings,
        entities=request.entities,
    )

    return result


@app.post("/pipeline/7/submit-job", status_code=201)
async def submit_job(
    request: SubmitJobRequest,
    pipeline: Pipeline = Depends(get_pipeline),
) -> None:
    await pipeline._submit_to_ufdr(
        session_id="TODO",
        result=request.generation_result,
    )
