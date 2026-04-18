
import json
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field

from ai_generator.models.story import StoryExpansion
from ai_generator.models.entity import Entity
from ai_generator.models.social_graph import SocialGraph
from ai_generator.models.timeline import TimelineEvent
from ai_generator.models.phone_selection import (
    PhoneSelectionRequest,
    PhoneSelectionResponse,
    PhoneSelectionConfirmation,
    SelectedPhone,
)
from ai_generator.models.phone_stories import PhoneStoryMapping, JobGenerationResult
from ai_generator.models.story_planning import StoryGenerationPlan


class SessionMetadata(BaseModel):
    
    session_id: str = Field(..., description="Unique session identifier")
    created_at: str = Field(..., description="ISO format timestamp when session was created")
    last_updated: str | None = Field(default=None, description="ISO format timestamp of last update")
    stages_completed: list[str] = Field(default_factory=list, description="List of completed stage names")


class PipelineStorage:
    
    def __init__(self, base_path: Path | str = "./pipeline_sessions"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def create_session(self, session_id: str | None = None) -> str:
        if session_id is None:
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        session_path = self.base_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        
        # Create metadata file
        metadata = SessionMetadata(
            session_id=session_id,
            created_at=datetime.now().isoformat(),
            stages_completed=[],
        )
        self._save_metadata(session_path / "metadata.json", metadata)
        
        return session_id
    
    def get_session_path(self, session_id: str) -> Path:
        return self.base_path / session_id
    
    def save_story(self, session_id: str, story: StoryExpansion) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "1_story_expansion.json",
            story.model_dump(mode='json')
        )
        self._update_metadata(session_id, "story_expansion")
    
    def load_story(self, session_id: str) -> StoryExpansion:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "1_story_expansion.json")
        return StoryExpansion(**data)
    
    def save_entities(self, session_id: str, entities: list[Entity]) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "2_entities.json",
            [e.model_dump(mode='json') for e in entities]
        )
        self._update_metadata(session_id, "entity_extraction")
    
    def load_entities(self, session_id: str) -> list[Entity]:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "2_entities.json")
        return [Entity(**e) for e in data]
    
    def save_social_graph(self, session_id: str, graph: SocialGraph) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "3_social_graph.json",
            graph.model_dump(mode='json')
        )
        self._update_metadata(session_id, "social_graph")
    
    def load_social_graph(self, session_id: str) -> SocialGraph:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "3_social_graph.json")
        return SocialGraph(**data)
    
    def save_timeline(self, session_id: str, events: list[TimelineEvent]) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "4_timeline.json",
            [e.model_dump(mode='json') for e in events]
        )
        self._update_metadata(session_id, "timeline_generation")
    
    def load_timeline(self, session_id: str) -> list[TimelineEvent]:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "4_timeline.json")
        return [TimelineEvent(**e) for e in data]
    
    # Phase 2: Phone extraction storage methods
    
    def save_phone_selection_request(
        self,
        session_id: str,
        request: PhoneSelectionRequest,
    ) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "5a_phone_selection_request.json",
            request.model_dump(mode='json')
        )
        self._update_metadata(session_id, "phone_selection_request")
    
    def load_phone_selection_request(self, session_id: str) -> PhoneSelectionRequest:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "5a_phone_selection_request.json")
        return PhoneSelectionRequest(**data)
    
    def save_phone_selection_response(
        self,
        session_id: str,
        response: PhoneSelectionResponse,
    ) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "5b_phone_selection_response.json",
            response.model_dump(mode='json')
        )
        self._update_metadata(session_id, "phone_selection_response")
    
    def load_phone_selection_response(self, session_id: str) -> PhoneSelectionResponse:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "5b_phone_selection_response.json")
        return PhoneSelectionResponse(**data)
    
    def save_selected_phones(
        self,
        session_id: str,
        confirmation: PhoneSelectionConfirmation,
    ) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "5c_selected_phones.json",
            confirmation.model_dump(mode='json')
        )
        self._update_metadata(session_id, "phone_selection_confirmed")
    
    def load_selected_phones(self, session_id: str) -> PhoneSelectionConfirmation:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "5c_selected_phones.json")
        return PhoneSelectionConfirmation(**data)
    
    def save_story_plan(
        self,
        session_id: str,
        plan: StoryGenerationPlan,
    ) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "6_story_plan.json",
            plan.model_dump(mode='json')
        )
        self._update_metadata(session_id, "story_planning")
    
    def load_story_plan(self, session_id: str) -> StoryGenerationPlan:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "6_story_plan.json")
        return StoryGenerationPlan(**data)
    
    def save_story_mappings(
        self,
        session_id: str,
        mappings: list[PhoneStoryMapping],
    ) -> None:
        session_path = self.get_session_path(session_id)
        # self._save_json(
        #     session_path / "7_story_mappings.json",
        #     [m.model_dump(mode='json') for m in mappings]
        # ) # todo: no storing session
        # self._update_metadata(session_id, "story_mapping")
    
    def load_story_mappings(self, session_id: str) -> list[PhoneStoryMapping]:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "7_story_mappings.json")
        return [PhoneStoryMapping(**m) for m in data]
    
    def save_generation_jobs(
        self,
        session_id: str,
        result: JobGenerationResult,
    ) -> None:
        session_path = self.get_session_path(session_id)
        self._save_json(
            session_path / "8_generation_jobs.json",
            result.model_dump(mode='json')
        )
        self._update_metadata(session_id, "job_generation")
    
    def load_generation_jobs(self, session_id: str) -> JobGenerationResult:
        session_path = self.get_session_path(session_id)
        data = self._load_json(session_path / "8_generation_jobs.json")
        return JobGenerationResult(**data)
    
    def list_sessions(self) -> list[SessionMetadata]:
        sessions: list[SessionMetadata] = []
        for session_dir in self.base_path.iterdir():
            if session_dir.is_dir():
                metadata_file = session_dir / "metadata.json"
                if metadata_file.exists():
                    sessions.append(self._load_metadata(metadata_file))
        
        # Sort by created_at descending
        sessions.sort(key=lambda s: s.created_at, reverse=True)
        return sessions
    
    def get_session_metadata(self, session_id: str) -> SessionMetadata:
        session_path = self.get_session_path(session_id)
        return self._load_metadata(session_path / "metadata.json")
    
    def _save_json(self, path: Path, data: dict[str, object] | list[dict[str, object]]) -> None:
        with path.open('w') as f:
            json.dump(data, f, indent=2, default=str)
    
    def _load_json(self, path: Path) -> dict[str, object] | list[dict[str, object]]:
        with path.open('r') as f:
            return json.load(f)  # type: ignore[return-value]
    
    def _save_metadata(self, path: Path, metadata: SessionMetadata) -> None:
        with path.open('w') as f:
            json.dump(metadata.model_dump(mode='json'), f, indent=2, default=str)
    
    def _load_metadata(self, path: Path) -> SessionMetadata:
        with path.open('r') as f:
            data = json.load(f)
            return SessionMetadata(**data)
    
    def _update_metadata(self, session_id: str, stage: str) -> None:
        session_path = self.get_session_path(session_id)
        metadata_path = session_path / "metadata.json"
        
        metadata = self._load_metadata(metadata_path)
        if stage not in metadata.stages_completed:
            metadata.stages_completed.append(stage)
            metadata.last_updated = datetime.now().isoformat()
            self._save_metadata(metadata_path, metadata)
