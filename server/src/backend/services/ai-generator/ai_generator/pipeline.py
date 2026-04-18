import asyncio
from collections import defaultdict
from datetime import date
from typing import Callable, List, Dict

from core.titan_logger import logger

from ai_generator.agents import (
    expand_story,
    extract_entities,
    build_social_graph,
    generate_timeline,
    generate_phone_candidates,
    plan_stories,
    JobAssemblyAgent,
)
from ai_generator.orchestration import generate_stories_from_plan
from ai_generator.models import (
    StoryExpansion,
    Entity,
    SocialGraph,
    TimelineEvent,
    DeviceType,
    SelectedPhone,
    PhoneSelectionResponse,
    PhoneSelectionConfirmation,
    StoryGenerationPlan,
    PlannedStory,
    PhoneStoryMapping,
    JobGenerationResult,
    StorySummary,
    EntitySummary,
    GraphSummary,
    TimelineSummary,
    JobsSummary,
    PipelineOutputs,
    PipelineSummary,
)
from ai_generator.models.phone_stories import DeviceTypeEnum, PhoneStoryMappingPhone
from ai_generator.storage import PipelineStorage
from ai_generator.services import UFDRClient
from model.stories import StoryData

# Type alias for review callback
# Signature: (stage_name, session_id) -> should_continue
ReviewCallback = Callable[[str, str], bool]


class Pipeline:
    """
    Unified pipeline for AI story generation.

    Transforms a story description into GenerationJobs through
    sequential stages with optional human review checkpoints.
    """

    def __init__(
        self,
        storage: PipelineStorage | None = None,
        model_name: str = "claude-sonnet-4-5",
    ):
        """
        Initialize the pipeline.

        Args:
            storage: PipelineStorage instance. If None, creates default
            model_name: LLM model name (for future use)
        """
        self.storage = storage or PipelineStorage()
        self.model_name = model_name
        self._job_assembly_agent: JobAssemblyAgent | None = None

    @property
    def job_assembly_agent(self) -> JobAssemblyAgent:
        """Get or create job assembly agent."""
        if self._job_assembly_agent is None:
            self._job_assembly_agent = JobAssemblyAgent()
        return self._job_assembly_agent

    # ========================================
    # Main Entry Points
    # ========================================

    async def run(
        self,
        description: str,
        session_id: str | None = None,
        phone_selections: list[SelectedPhone] | None = None,
        review_callback: ReviewCallback | None = None,
        submit_to_ufdr: bool = True,
    ) -> tuple[str, JobGenerationResult]:
        """
        Run the complete pipeline from description to GenerationJobs.

        Args:
            description: Short story description from user
            session_id: Optional session ID. If None, creates new session
            phone_selections: Optional pre-selected phones. If None, auto-selects
            review_callback: Optional callback for human review between stages.
                Signature: (stage_name: str, session_id: str) -> bool
                Return True to continue, False to pause
            submit_to_ufdr: Whether to submit jobs to UFDR (default: False)

        Returns:
            Tuple of (session_id, JobGenerationResult)
        """
        # Create session
        if session_id is None:
            session_id = self.storage.create_session()

        logger.info("=" * 60)
        logger.info("AI STORY GENERATION PIPELINE")
        logger.info("Session: %s", session_id)
        logger.info("=" * 60)

        # Stage 1: Story Expansion
        story = await self._run_story_expansion(session_id, description)
        if review_callback and not review_callback("story_expansion", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 2: Entity Extraction
        entities = await self._run_entity_extraction(session_id, story)
        if review_callback and not review_callback("entity_extraction", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 3: Social Graph
        graph = await self._run_social_graph(session_id, story, entities)
        if review_callback and not review_callback("social_graph", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 4: Timeline Generation
        timeline = await self._run_timeline_generation(
            session_id, story, entities, graph
        )
        if review_callback and not review_callback("timeline_generation", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 5: Phone Selection
        selected_phones = await self._run_phone_selection(
            session_id, entities, timeline, graph, phone_selections
        )
        if review_callback and not review_callback("phone_selection", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 6: Story Planning
        plan = await self._run_story_planning(
            session_id, selected_phones, timeline, entities
        )
        if review_callback and not review_callback("story_planning", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 7: Story Generation
        story_mappings = await self._run_story_generation(
            session_id, selected_phones, plan, timeline, entities
        )
        if review_callback and not review_callback("story_generation", session_id):
            return session_id, self._empty_result(session_id)

        # Stage 8: Job Assembly
        result = self._run_job_assembly(
            session_id, selected_phones, story_mappings, entities
        )

        # Optional: Submit to UFDR
        if submit_to_ufdr:
            result = await self._submit_to_ufdr(session_id, result)

        # Final summary
        logger.info("=" * 60)
        logger.info("PIPELINE COMPLETE")
        logger.info("Session: %s", session_id)
        logger.info("Stories Generated: %d", result.total_stories_generated)
        logger.info("Jobs Created: %d", result.total_jobs_created)
        if submit_to_ufdr and result.ufdr_submissions:
            success_count = sum(1 for s in result.ufdr_submissions if s.success)
            logger.info(
                "Jobs Submitted: %d/%d", success_count, len(result.ufdr_submissions)
            )
        logger.info("=" * 60)

        return session_id, result

    async def run_to_timeline(
        self,
        description: str,
        session_id: str | None = None,
        review_callback: ReviewCallback | None = None,
    ) -> tuple[str, list[TimelineEvent]]:
        """
        Run pipeline stages 1-4 only (up to timeline generation).

        Useful when you only need the timeline without job generation.

        Args:
            description: Short story description from user
            session_id: Optional session ID
            review_callback: Optional callback for human review

        Returns:
            Tuple of (session_id, list of TimelineEvent)
        """
        if session_id is None:
            session_id = self.storage.create_session()

        logger.info("Running pipeline to timeline for session %s", session_id)

        # Stage 1: Story Expansion
        story = await self._run_story_expansion(session_id, description)
        if review_callback and not review_callback("story_expansion", session_id):
            return session_id, []

        # Stage 2: Entity Extraction
        entities = await self._run_entity_extraction(session_id, story)
        if review_callback and not review_callback("entity_extraction", session_id):
            return session_id, []

        # Stage 3: Social Graph
        graph = await self._run_social_graph(session_id, story, entities)
        if review_callback and not review_callback("social_graph", session_id):
            return session_id, []

        # Stage 4: Timeline Generation
        timeline = await self._run_timeline_generation(
            session_id, story, entities, graph
        )

        return session_id, timeline

    # ========================================
    # Individual Stage Methods
    # ========================================

    async def _run_story_expansion(
        self,
        session_id: str,
        description: str,
    ) -> StoryExpansion:
        """Stage 1: Expand user prompt into detailed narrative."""
        logger.info("Stage 1: Story Expansion")

        story = await expand_story(description)
        self.storage.save_story(session_id, story)

        logger.info("Story expanded: %d chars", len(story.expanded_narrative))

        return story

    async def _run_entity_extraction(
        self,
        session_id: str,
        story: StoryExpansion,
    ) -> list[Entity]:
        """Stage 2: Extract entities from story."""
        logger.info("Stage 2: Entity Extraction")

        entities = await extract_entities(story)
        self.storage.save_entities(session_id, entities)

        logger.info("Extracted %d entities", len(entities))

        return entities

    async def _run_social_graph(
        self,
        session_id: str,
        story: StoryExpansion,
        entities: list[Entity],
    ) -> SocialGraph:
        """Stage 3: Build social graph from entities."""
        logger.info("Stage 3: Social Graph")

        graph = await build_social_graph(story, entities)
        self.storage.save_social_graph(session_id, graph)

        logger.info("Created graph with %d relationships", len(graph.relationships))

        return graph

    async def _run_timeline_generation(
        self,
        session_id: str,
        story: StoryExpansion,
        entities: list[Entity],
        graph: SocialGraph,
    ) -> list[TimelineEvent]:
        """Stage 4: Generate timeline of events."""
        logger.info("Stage 4: Timeline Generation")

        timeline = await generate_timeline(story, entities, graph)
        self.storage.save_timeline(session_id, timeline)

        logger.info("Generated %d timeline events", len(timeline))

        return timeline

    async def _run_phone_selection(
        self,
        session_id: str,
        entities: list[Entity],
        timeline: list[TimelineEvent],
        graph: SocialGraph,
        pre_selected: list[SelectedPhone] | None = None,
    ) -> list[SelectedPhone]:
        """Stage 5: Select phones for generation."""
        logger.info("Stage 5: Phone Selection")

        if pre_selected:
            # Use pre-selected phones
            self._save_phone_confirmation(session_id, pre_selected)
            logger.info("Using %d pre-selected phones", len(pre_selected))
            return pre_selected

        # Generate candidates
        candidates = await generate_phone_candidates(
            entities=entities,
            timeline=timeline,
            social_graph=graph,
        )

        # Save response
        response = PhoneSelectionResponse(session_id=session_id, candidates=candidates)
        self.storage.save_phone_selection_response(session_id, response)

        logger.info("Generated %d phone candidates", len(candidates))

        recommended = [c.entity_name for c in candidates if c.recommended]
        if recommended:
            logger.debug("Recommended phones: %s", recommended)

        # Auto-select top 2 recommended
        selected = self._auto_select_phones(response, entities, timeline)
        self._save_phone_confirmation(session_id, selected)

        return selected

    async def _run_story_planning(
        self,
        session_id: str,
        selected_phones: list[SelectedPhone],
        timeline: list[TimelineEvent],
        entities: list[Entity],
        max_iterations: int = 2,
    ) -> StoryGenerationPlan:
        """
        Stage 6: Plan which stories to generate with validation.
        
        This implements an iterative loop:
        1. Generate initial plan
        2. Validate plan
        3. If validation finds missing stories, add them
        4. Repeat until validation passes or max iterations reached
        """
        logger.info("Stage 6: Story Planning with Validation")

        # Import here to avoid circular dependency
        from ai_generator.agents.story_validation import validate_story_plan
        from ai_generator.agents.story_planning import incorporate_validation_feedback

        iteration = 1
        plan: StoryGenerationPlan | None = None
        validation_report = None
        
        while iteration <= max_iterations:
            logger.info(f"Planning iteration {iteration}/{max_iterations}")
            
            # Generate/update plan
            if iteration == 1:
                # Initial planning
                plan = await plan_stories(
                    timeline=timeline,
                    selected_phones=selected_phones,
                    entities=entities,
                )
            else:
                # Incorporate feedback from previous validation
                if validation_report and plan:
                    plan = incorporate_validation_feedback(plan, validation_report)
            
            if plan:
                logger.info(f"  Current plan: {plan.total_planned_stories} stories")
            
            # Validate plan
            if plan:
                validation_report = await validate_story_plan(
                    plan=plan,
                    timeline=timeline,
                    selected_phones=selected_phones,
                    entities=entities,
                    iteration=iteration,
                )
            
                # Check if validation passed
                if validation_report.validation_passed:
                    logger.info(f"✓ Validation passed on iteration {iteration}")
                    break
                
                # Check if we have critical gaps
                if validation_report.critical_gaps_count > 0:
                    logger.info(
                        f"  Found {validation_report.critical_gaps_count} critical gaps, "
                        f"will iterate to add {validation_report.total_missing_stories} stories"
                    )
                else:
                    # No critical gaps, but could add more stories
                    logger.info(
                        f"  No critical gaps, but could add {validation_report.total_missing_stories} "
                        "stories for better coverage"
                    )
                
            iteration += 1
        
        if not plan:
            raise ValueError("Failed to generate story plan")
        
        # Final summary
        if iteration > max_iterations:
            logger.info(
                f"Reached max iterations ({max_iterations}). "
                f"Final plan has {plan.total_planned_stories} stories"
            )
        
        logger.info("=" * 60)
        logger.info("STORY PLANNING COMPLETE")
        logger.info(f"  Total iterations: {iteration}")
        logger.info(f"  Total stories planned: {plan.total_planned_stories}")
        logger.info(f"  Events covered: {len(plan.event_plans)}")

        # Log summary per phone
        for phone in selected_phones:
            phone_stories = plan.get_stories_for_phone(phone.entity_id)
            logger.info(
                "  Phone %s: %d stories planned", phone.entity_name, len(phone_stories)
            )

        sync_groups = plan.get_sync_groups()
        if sync_groups:
            logger.info(f"  Sync groups: {len(sync_groups)}")

        logger.info("=" * 60)

        return plan

    async def _run_story_generation(
        self,
        session_id: str,
        selected_phones: list[SelectedPhone],
        plan: StoryGenerationPlan,
        timeline: list[TimelineEvent],
        entities: list[Entity],
    ) -> list[PhoneStoryMapping]:
        """Stage 7: Generate actual story data using specialized agents."""
        logger.info("Stage 7: Story Generation")

        # Use new orchestration to generate all stories
        # This delegates to specialized agents (email, chat, sms, simple story)
        phone_stories = await generate_stories_from_plan(
            plan=plan,
            timeline=timeline,
            entities=entities,
        )
        
        logger.info(
            "Story generation complete: %d phones, %d total stories",
            len(phone_stories),
            sum(len(stories) for stories in phone_stories.values()),
        )

        # 2.5: Generate routine/ambient stories
        # logger.info("Stage 7.5a: Routine Generation")
        # from ai_generator.routine_generation import generate_routine_stories
        # from ai_generator.models.routine_config import RoutineGenerationConfig
        # from ai_generator.settings import SETTINGS
        #
        # # Build config from settings
        # routine_config = RoutineGenerationConfig(
        #     enabled=SETTINGS.ROUTINE_GENERATION_ENABLED,
        #     density=SETTINGS.ROUTINE_GENERATION_DENSITY,  # type: ignore[arg-type]
        #     timing_variation_minutes=SETTINGS.ROUTINE_GENERATION_TIMING_VARIATION,
        #     duration_variation_pct=SETTINGS.ROUTINE_GENERATION_DURATION_VARIATION,
        #     entity_aware_skip=SETTINGS.ROUTINE_GENERATION_ENTITY_AWARE_SKIP,
        #     adjust_for_timeline_events=SETTINGS.ROUTINE_GENERATION_ADJUST_FOR_TIMELINE,
        #     timeline_event_buffer_minutes=SETTINGS.ROUTINE_GENERATION_TIMELINE_BUFFER,
        # )
        # entity_map = {e.entity_id: e for e in entities}
        #
        # for phone in selected_phones:
        #     entity = entity_map.get(phone.entity_id)
        #     if not entity:
        #         continue
        #
        #     try:
        #         routine_stories = await generate_routine_stories(
        #             phone=phone,
        #             entity=entity,
        #             timeline_events=timeline,
        #             config=routine_config,
        #         )
        #
        #         if routine_stories:
        #             # Merge routine stories with storyline stories
        #             existing_stories = phone_stories.get(phone.entity_id, [])
        #             phone_stories[phone.entity_id] = existing_stories + routine_stories
        #             logger.info(
        #                 "Added %d routine stories to phone %s (total: %d)",
        #                 len(routine_stories),
        #                 phone.entity_name,
        #                 len(phone_stories[phone.entity_id]),
        #             )
        #     except Exception as e:
        #         logger.error(
        #             "Failed to generate routine stories for %s: %s",
        #             phone.entity_name,
        #             e,
        #         )
        #         # Continue with other phones even if one fails

        # 3. Generate media for file-based stories
        logger.info("Stage 7.5b: Media Generation")
        entity_map = {e.entity_id: e for e in entities}

        for phone_id, stories in phone_stories.items():
            if not stories:
                continue

            logger.info(
                "Generating media for %d stories on phone %s", len(stories), phone_id
            )

            # Import here to avoid circular dependency
            from ai_generator.services import MediaGeneratorService

            media_service = MediaGeneratorService(job_id=session_id)
            updated_stories = await media_service.generate_media_for_stories(
                stories=stories,
                entities=entity_map,
            )

            # Replace with updated stories (failed stories removed, successful ones have S3 paths)
            phone_stories[phone_id] = updated_stories

            logger.info(
                "Media generation complete for phone %s: %d stories remaining",
                phone_id,
                len(updated_stories),
            )

        # 4. Build PhoneStoryMapping for each phone
        mappings: list[PhoneStoryMapping] = []

        for phone in selected_phones:
            stories = phone_stories.get(phone.entity_id, [])
            mapping = self._build_phone_mapping(phone, stories)
            mappings.append(mapping)

            logger.info(
                "Phone %s: %d stories generated", phone.entity_name, len(stories)
            )

        self.storage.save_story_mappings(session_id, mappings)

        return mappings

    def _run_job_assembly(
        self,
        session_id: str,
        selected_phones: list[SelectedPhone],
        story_mappings: list[PhoneStoryMapping],
        entities: list[Entity],
    ) -> JobGenerationResult:
        """Stage 8: Assemble GenerationJobs."""
        logger.info("Stage 8: Job Assembly")

        result = self.job_assembly_agent.assemble_jobs(
            session_id=session_id,
            phones=selected_phones,
            story_mappings=story_mappings,
            entities=entities,
        )

        # self.storage.save_generation_jobs(session_id, result)

        logger.info(
            "Created %d jobs with %d stories",
            result.total_jobs_created,
            result.total_stories_generated,
        )

        return result

    async def _submit_to_ufdr(
        self,
        session_id: str,
        result: JobGenerationResult,
    ) -> JobGenerationResult:
        """Submit jobs to UFDR endpoint."""
        logger.info("Submitting jobs to UFDR")

        client = UFDRClient()
        responses = await client.submit_jobs_batch(result.generation_jobs)

        from ai_generator.models import UFDRJobSubmission

        submissions = []
        for i, response in enumerate(responses):
            job = result.generation_jobs[i]
            phone_mapping = result.phone_mappings[i]

            submission = UFDRJobSubmission(
                job_id=job.job_id,
                phone_entity_name=phone_mapping.phone.entity_name,
                success=response.success,
                message=getattr(response, "message", None),
                error=getattr(response, "error", None),
            )
            submissions.append(submission)

            logger.debug(
                "Job %s (%s): %s",
                submission.job_id,
                submission.phone_entity_name,
                "success" if submission.success else f"failed - {submission.error}",
            )

        result.ufdr_submissions = submissions
        result.all_jobs_submitted = all(s.success for s in submissions)

        # self.storage.save_generation_jobs(session_id, result)

        success_count = sum(1 for s in submissions if s.success)
        logger.info("Submitted %d/%d jobs", success_count, len(submissions))

        return result

    # ========================================
    # Helper Methods
    # ========================================

    def _empty_result(self, session_id: str) -> JobGenerationResult:
        """Create empty result for paused pipeline."""
        return JobGenerationResult(
            session_id=session_id,
            phone_mappings=[],
            total_stories_generated=0,
            total_jobs_created=0,
        )

    def _auto_select_phones(
        self,
        response: PhoneSelectionResponse,
        entities: list[Entity],
        timeline: list[TimelineEvent],
    ) -> list[SelectedPhone]:
        """Auto-select top 2 recommended phones."""
        entity_map = {e.entity_id: e for e in entities}

        # Get date range from timeline
        if timeline:
            dates = [e.timestamp for e in timeline]
            start_date = min(dates).date()
            end_date = max(dates).date()
        else:
            start_date = date.today().replace(month=1, day=1)
            end_date = date.today()

        # Get recommended candidates
        recommended = [c for c in response.candidates if c.recommended]

        if len(recommended) < 2:
            raise ValueError(
                f"Need at least 2 recommended phone candidates. Got {len(recommended)}."
            )

        # Select top 2
        selected = []
        for idx, candidate in enumerate(recommended[:2]):
            entity = entity_map.get(candidate.entity_id)
            if not entity:
                continue

            device_type = DeviceType.IPHONE if idx == 0 else DeviceType.ANDROID

            phone = SelectedPhone(
                entity_id=candidate.entity_id,
                entity_name=candidate.entity_name,
                device_type=device_type,
                phone_number=entity.phone_numbers[0] if entity.phone_numbers else None,
                email=entity.emails[0] if entity.emails else None,
                start_date=start_date,
                end_date=end_date,
            )
            selected.append(phone)

        if len(selected) != 2:
            raise ValueError(f"Failed to select 2 phones. Created {len(selected)}.")

        logger.info("Auto-selected phones: %s", [p.entity_name for p in selected])

        return selected

    def _save_phone_confirmation(
        self,
        session_id: str,
        phones: list[SelectedPhone],
    ) -> None:
        """Save phone selection confirmation."""
        confirmation = PhoneSelectionConfirmation(
            session_id=session_id,
            selected_phones=phones,
        )
        self.storage.save_selected_phones(session_id, confirmation)

    def _find_event_for_story(
        self,
        planned: PlannedStory,
        plan: StoryGenerationPlan,
    ) -> str | None:
        """Find timeline event ID for a planned story."""
        for event_plan in plan.event_plans:
            if planned in event_plan.planned_stories:
                return event_plan.timeline_event_id
        return None

    def _build_phone_mapping(
        self,
        phone: SelectedPhone,
        stories: List[StoryData],
    ) -> PhoneStoryMapping:
        """Build PhoneStoryMapping from generated stories."""
        # Calculate story type counts
        story_type_counts: Dict[str, int] = defaultdict(int)
        for story in stories:
            story_type_counts[story.story_type.value] += 1

        # Build event to story mapping
        event_to_story_map: dict[str, list[str]] = defaultdict(list)
        for story in stories:
            if hasattr(story, "source_event_id") and story.source_event_id:
                event_to_story_map[story.source_event_id].append(story.uid)

        # Get referenced entity IDs
        referenced_entity_ids: set[str] = set()
        for story in stories:
            for key in [
                "sender",
                "recipient",
                "parties",
                "to_addresses",
                "from_address",
            ]:
                if hasattr(story, key):
                    val = getattr(story, key)
                    if isinstance(val, list):
                        referenced_entity_ids.update(str(v) for v in val)
                    elif val is not None:
                        referenced_entity_ids.add(str(val))

        # Convert device type
        device_type_value = phone.device_type.value if phone.device_type else "generic"
        device_type_enum = DeviceTypeEnum(device_type_value)

        phone_info = PhoneStoryMappingPhone(
            entity_id=phone.entity_id,
            entity_name=phone.entity_name,
            device_type=device_type_enum,
            phone_number=phone.phone_number,
            email=phone.email,
            start_date=phone.start_date,
            end_date=phone.end_date,
        )

        return PhoneStoryMapping(
            phone=phone_info,
            stories=stories,
            event_to_story_map=dict(event_to_story_map),
            referenced_entity_ids=list(referenced_entity_ids),
            story_type_counts=dict(story_type_counts),
        )

    # ========================================
    # Session Management
    # ========================================

    async def resume(
        self,
        session_id: str,
        from_stage: str,
        phone_selections: list[SelectedPhone] | None = None,
    ) -> JobGenerationResult:
        """
        Resume pipeline from a specific stage.

        Args:
            session_id: Session ID to resume
            from_stage: Stage to resume from (e.g., 'timeline_generation', 'story_planning')
            phone_selections: Optional phone selections for later stages

        Returns:
            JobGenerationResult
        """
        logger.info("Resuming session %s from stage %s", session_id, from_stage)

        # Load required data based on stage
        story = self.storage.load_story(session_id)
        entities = self.storage.load_entities(session_id)
        graph = self.storage.load_social_graph(session_id)
        timeline = self.storage.load_timeline(session_id)

        if from_stage == "phone_selection":
            selected = await self._run_phone_selection(
                session_id, entities, timeline, graph, phone_selections
            )
            plan = await self._run_story_planning(
                session_id, selected, timeline, entities
            )
            mappings = await self._run_story_generation(
                session_id, selected, plan, timeline, entities
            )
            return self._run_job_assembly(session_id, selected, mappings, entities)

        elif from_stage == "story_planning":
            confirmation = self.storage.load_selected_phones(session_id)
            selected = confirmation.selected_phones
            plan = await self._run_story_planning(
                session_id, selected, timeline, entities
            )
            mappings = await self._run_story_generation(
                session_id, selected, plan, timeline, entities
            )
            return self._run_job_assembly(session_id, selected, mappings, entities)

        elif from_stage == "story_generation":
            confirmation = self.storage.load_selected_phones(session_id)
            selected = confirmation.selected_phones
            plan = self.storage.load_story_plan(session_id)
            mappings = await self._run_story_generation(
                session_id, selected, plan, timeline, entities
            )
            return self._run_job_assembly(session_id, selected, mappings, entities)

        elif from_stage == "job_assembly":
            confirmation = self.storage.load_selected_phones(session_id)
            selected = confirmation.selected_phones
            mappings = self.storage.load_story_mappings(session_id)
            return self._run_job_assembly(session_id, selected, mappings, entities)

        else:
            raise ValueError(f"Unknown stage: {from_stage}")

    def get_summary(self, session_id: str) -> PipelineSummary:
        """Get summary of a pipeline session."""
        metadata = self.storage.get_session_metadata(session_id)

        outputs = PipelineOutputs()

        # Load available outputs
        try:
            story = self.storage.load_story(session_id)
            outputs.story = StorySummary(
                setting=story.setting,
                themes=story.key_themes,
                narrative_length=len(story.expanded_narrative),
            )
        except FileNotFoundError:
            pass

        try:
            entities = self.storage.load_entities(session_id)
            outputs.entities = EntitySummary(
                count=len(entities),
                names=[e.name for e in entities[:5]],
            )
        except FileNotFoundError:
            pass

        try:
            graph = self.storage.load_social_graph(session_id)
            outputs.graph = GraphSummary(
                relationships=len(graph.relationships),
            )
        except FileNotFoundError:
            pass

        try:
            timeline = self.storage.load_timeline(session_id)
            outputs.timeline = TimelineSummary(
                events=len(timeline),
            )
        except FileNotFoundError:
            pass

        try:
            result = self.storage.load_generation_jobs(session_id)
            outputs.jobs = JobsSummary(
                count=result.total_jobs_created,
                stories=result.total_stories_generated,
            )
        except FileNotFoundError:
            pass

        return PipelineSummary(
            session_id=session_id,
            metadata=metadata,
            outputs=outputs,
        )
