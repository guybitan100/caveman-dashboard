import uuid
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Set

from core.titan_logger import logger

from model.job import GenerationJob, DeviceContext, DeviceModel
from model.types import DeviceInfo, DeviceInfoEntry
from model.types import Entity as JobEntity
from model.stories import StoryData

from ai_generator.models import (
    DeviceType,
    Entity,
    JobGenerationResult,
    PhoneStoryMapping,
    SelectedPhone,
    get_app_registry,
)


class JobAssemblyAgent:
    """
    Agent that assembles GenerationJobs from story mappings.

    This agent is primarily deterministic - it doesn't use an LLM.
    It transforms the AI-generated content into the required format.
    """
    
    def __init__(self) -> None:
        """Initialize the job assembly agent."""
        pass

    @staticmethod
    def _convert_device_type_to_os(device_type: DeviceType | None) -> str:
        if device_type == DeviceType.IPHONE:
            return "iOS"
        elif device_type == DeviceType.ANDROID:
            return "Android"
        else:
            return "Android"

    @staticmethod
    def _convert_device_type_to_model(device_type: DeviceType | None) -> str: # Todo: choose random model from a list
        """Convert DeviceType to device model string."""
        if device_type == DeviceType.IPHONE:
            return "iPhone 15 Pro"
        elif device_type == DeviceType.ANDROID:
            return "Galaxy S24"
        else:
            return "Generic Smartphone"

    @staticmethod
    def _convert_device_type_to_manufacturer(device_type: DeviceType | None) -> str:
        """Convert DeviceType to device manufacturer string."""
        if device_type == DeviceType.IPHONE:
            return "Apple"
        elif device_type == DeviceType.ANDROID:
            return "Samsung"
        else:
            return "Generic Manufacturer"

    @staticmethod
    def _create_owner_entity(
        phone: SelectedPhone,
        entity: Entity | None,
    ) -> JobEntity:
        name_parts = phone.entity_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else None

        is_male: bool | None = None
        if entity and entity.characteristics and entity.characteristics.gender:
            is_male = entity.characteristics.gender.value == "male"
        
        return JobEntity(
            uid=entity.entity_id if entity else None,
            is_owner=True,
            first_name=first_name,
            last_name=last_name,
            phone=phone.phone_number,
            email=phone.email,
            is_male=is_male,
        )

    @staticmethod
    def _create_entity_from_data(
        entity: Entity,
    ) -> JobEntity:
        name_parts = entity.name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else None

        phone = entity.phone_numbers[0] if entity.phone_numbers else None
        email = entity.emails[0] if entity.emails else None

        is_male: bool | None = None
        if entity.characteristics and entity.characteristics.gender:
            is_male = entity.characteristics.gender.value == "male"
        
        return JobEntity(
            uid=entity.entity_id,
            is_owner=False,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            email=email,
            is_male=is_male,
        )

    def _cleanup_null_string(self, data: Any) -> Any:
        if isinstance(data, str):
            if data.lower() == "null":
                return None
        elif isinstance(data, dict):
            for k, v in data.items():
                data[k] = self._cleanup_null_string(v)
            return data
        elif isinstance(data, list):
            return [self._cleanup_null_string(v) for v in data]
        return data

    def _convert_story_to_dict(
            self,
        story: StoryData,
    ) -> Dict[str, Any]:

        story_dict = story.model_dump()

        for k, v in story_dict.items():
            story_dict[k] = self._cleanup_null_string(v)
        
        # Ensure required fields
        if "uid" not in story_dict or not story_dict["uid"]:
            story_dict["uid"] = str(uuid.uuid4())
        
        # Convert timestamp if needed
        if "time" in story_dict:
            time_val = story_dict["time"]
            if isinstance(time_val, datetime):
                story_dict["time"] = time_val.isoformat()
            elif isinstance(time_val, str):
                # Validate it's ISO format
                try:
                    datetime.fromisoformat(time_val.replace("Z", "+00:00"))
                except ValueError:
                    story_dict["time"] = datetime.now().isoformat()
        else:
            story_dict["time"] = datetime.now().isoformat()
        
        # Ensure story_type is valid
        valid_story_types = {
            "location", "image", "document", "video", "audio",
            "sms/mms", "call", "email", "app", "contact",
            "powering event", "web bookmarks", "web history", "cookie",
            "chat", "route", "chat message"
        }
        story_type = story_dict.get("story_type", "")
        if isinstance(story_type, str):
            story_type_lower = story_type.lower()
        else:
            # Handle enum
            story_type_lower = str(story_type.value).lower() if hasattr(story_type, "value") else str(story_type).lower()
            story_dict["story_type"] = story_type_lower
        
        if story_type_lower not in valid_story_types:
            # Try to normalize
            if "message" in story_type_lower or "sms" in story_type_lower or "text" in story_type_lower:
                story_dict["story_type"] = "sms/mms"
            elif "chat" in story_type_lower:
                story_dict["story_type"] = "chat"
            # Otherwise leave as-is for validation to catch
        
        return story_dict

    @staticmethod
    def _collect_app_ids(stories: List[StoryData]) -> Set[str]:
        """
        Collect all unique app_id references from stories.
        
        Args:
            stories: List of StoryData models
            
        Returns:
            Set of unique app_ids found in stories (excludes None/empty/"null" values)
        """
        app_ids: Set[str] = set()
        
        for story in stories:
            # Check for app_id attribute (EventStoryData subclasses)
            app_id_val = getattr(story, "app_id", None)
            # Only add if it's a valid non-empty string (not None, not empty, not "null")
            if (app_id_val and isinstance(app_id_val, str) and 
                app_id_val.strip() and app_id_val.lower() != "null"):
                app_ids.add(app_id_val)
            
            # Check for app attribute (AppStoryData has nested app object)
            app_obj = getattr(story, "app", None)
            if app_obj:
                nested_app_id = getattr(app_obj, "app_id", None)
                # Only add if it's a valid non-empty string (not "null")
                if (nested_app_id and isinstance(nested_app_id, str) and 
                    nested_app_id.strip() and nested_app_id.lower() != "null"):
                    app_ids.add(nested_app_id)
        
        return app_ids

    @staticmethod
    def _create_app_story(
            app_id: str,
    ) -> Dict[str, Any]:
        """
        Create an AppStoryData dict for a given app_id.
        
        Args:
            app_id: The app identifier (e.g., 'com.google.android.apps.maps')
            
        Returns:
            Dict with AppStoryData schema: {uid, story_type, time, app: {app_id, name}}
        """
        # Look up app info from registry
        registry = get_app_registry()
        app_info = registry.get_app_by_id(app_id)
        
        # Use display name from registry if available, otherwise derive from app_id
        if app_info:
            display_name = app_info.display_name
        else:
            # Try to derive a reasonable name from the app_id
            # e.g., "com.google.android.apps.maps" -> "Maps"
            parts = app_id.split(".")
            display_name = parts[-1].replace("_", " ").title() if parts else app_id
        
        # AppStoryData requires an 'app' field with nested 'app_id' and 'name'
        return {
            "uid": str(uuid.uuid4()),
            "story_type": "app",
            "time": datetime.now().isoformat(),
            "app": {
                "app_id": app_id,
                "name": display_name,
            },
        }
    
    def _generate_app_stories(
        self,
        stories: List[StoryData],
        device_type: Optional[DeviceType] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate AppStoryData for all app_ids referenced in stories.
        
        This ensures that every app_id mentioned in a story has a corresponding
        app story, which is required by the generation service.
        
        Args:
            stories: List of StoryData models
            device_type: Optional device type for app lookup
            
        Returns:
            List of AppStoryData dicts (one per unique app_id)
        """
        app_ids = self._collect_app_ids(stories)
        
        app_stories: list[dict[str, str | int | float | bool | list | dict | None]] = []
        for app_id in app_ids:
            app_story = self._create_app_story(app_id)
            app_stories.append(app_story)
        
        return app_stories
    
    def assemble_job(
        self,
        session_id: str,
        phone: SelectedPhone,
        story_mapping: PhoneStoryMapping,
        entities: List[Entity],
        job_name: Optional[str] = None,
    ) -> GenerationJob:
        """
        Assemble a GenerationJob for a single phone.
        
        Args:
            session_id: Pipeline session ID
            phone: Selected phone
            story_mapping: Story mapping for this phone
            entities: All entities for reference
            job_name: Optional job name
            
        Returns:
            GenerationJob ready for the generation service
        """
        logger.info(
            "Assembling job for phone",
            entity_name=phone.entity_name,
            entity_id=phone.entity_id,
        )
        
        # Build entity lookup
        entity_map = {e.entity_id: e for e in entities}
        owner_entity_data = entity_map.get(phone.entity_id)
        
        # Create owner entity
        owner = self._create_owner_entity(phone, owner_entity_data)
        
        # Create other entities (referenced in stories)
        other_entities: list[JobEntity] = [self._create_entity_from_data(entity) for entity in entities if entity.entity_id != phone.entity_id]
        
        logger.debug(
            "Job includes other entities",
            count=len(other_entities),
        )
        
        # Convert stories to dicts for GenerationJob
        story_dicts = [
            self._convert_story_to_dict(s)
            for s in story_mapping.stories
        ]
        
        logger.info(
            "Converted stories for job",
            story_count=len(story_dicts),
        )
        
        # Generate app stories for all referenced app_ids
        app_stories: List[Dict[str, Any]] = self._generate_app_stories(story_mapping.stories, phone.device_type)
        
        if app_stories:
            app_ids_list: List[str] = []
            for story_dict in app_stories:
                app_data = story_dict.get("app", {})
                if isinstance(app_data, dict):
                    app_id = app_data.get("app_id", "unknown")
                    app_ids_list.append(str(app_id))
            
            logger.info(
                "Generated app stories",
                count=len(app_stories),
                app_ids=app_ids_list,
            )
        
        # Combine app stories with regular stories (app stories should come first)
        all_stories = app_stories + story_dicts
        
        # Determine date range
        start_date = phone.start_date or date.today().replace(month=1, day=1)
        end_date = phone.end_date or date.today()
        
        logger.debug(
            "Job date range",
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
        )
        
        # Build device info
        context: DeviceContext = DeviceContext(
            start_date=start_date,
            end_date=end_date,
            device=DeviceModel(
                os=self._convert_device_type_to_os(phone.device_type),
                model=self._convert_device_type_to_model(phone.device_type),
                manufacturer=self._convert_device_type_to_manufacturer(phone.device_type),
            )
        )
        device_info = DeviceInfo(
            # os=self._convert_device_type_to_os(phone.device_type),
            # model=self._convert_device_type_to_model(phone.device_type),
            entries=[
                DeviceInfoEntry(key="ai_generated", value="true"),
                DeviceInfoEntry(key="session_id", value=session_id),
            ],
        )
        
        # Build device context
        context = DeviceContext(
            device_info=device_info,
            start_date=start_date,
            end_date=end_date,
        )
        
        # Build job
        job = GenerationJob(
            job_id=f"{session_id}_{phone.entity_id}"[:36],  # Limit to 36 chars
            name=job_name or f"AI Generated - {phone.entity_name}",
            tasks=[],  # Stories-based job, no random tasks
            context=context,
            stories=all_stories,
            owner_entity=owner,
            entities=other_entities,
        )
        
        logger.info(
            "Job assembly complete",
            job_id=job.job_id,
            total_stories=len(all_stories),
            app_stories=len(app_stories),
            regular_stories=len(story_dicts),
        )
        
        return job
    
    def assemble_jobs(
        self,
        session_id: str,
        phones: List[SelectedPhone],
        story_mappings: List[PhoneStoryMapping],
        entities: List[Entity],
    ) -> JobGenerationResult:
        """
        Assemble GenerationJobs for all phones.
        
        Args:
            session_id: Pipeline session ID
            phones: List of selected phones
            story_mappings: Story mappings (one per phone)
            entities: All entities
            
        Returns:
            JobGenerationResult with all jobs
        """
        logger.info(
            "Assembling jobs",
            phone_count=len(phones),
            session_id=session_id,
        )
        
        # Match phones to mappings by entity_id
        mapping_by_entity: Dict[str, PhoneStoryMapping] = {m.phone.entity_id: m for m in story_mappings}
        
        jobs: List[GenerationJob] = []
        total_stories: int = 0
        
        for phone in phones:
            mapping = mapping_by_entity.get(phone.entity_id)
            if not mapping:
                logger.warn(
                    "No story mapping found for phone, skipping",
                    entity_name=phone.entity_name,
                    entity_id=phone.entity_id,
                )
                continue
            
            job = self.assemble_job(
                session_id=session_id,
                phone=phone,
                story_mapping=mapping,
                entities=entities,
            )
            jobs.append(job)
            total_stories += len(job.stories)
        
        logger.info(
            "Job assembly complete",
            jobs_created=len(jobs),
            total_stories=total_stories,
            avg_stories_per_job=total_stories / len(jobs) if jobs else 0,
        )
        
        return JobGenerationResult(
            session_id=session_id,
            phone_mappings=story_mappings,
            generation_jobs=jobs,
            total_stories_generated=total_stories,
            total_jobs_created=len(jobs),
        )
    
    def validate_job(self, job: GenerationJob) -> List[str]:
        """
        Validate a job before submission.
        
        Args:
            job: GenerationJob model
            
        Returns:
            List of validation error messages (empty if valid)
        """
        logger.debug("Validating job", job_id=job.job_id)
        
        errors: List[str] = []
        
        # Check required fields
        if not job.job_id:
            errors.append("Missing job_id")
        
        if not job.stories and not job.tasks:
            errors.append("Job must have either stories or tasks")
        
        # Validate stories
        for i, story in enumerate(job.stories):
            story_dict = story if isinstance(story, dict) else story.model_dump()
            if not story_dict.get("story_type"):
                errors.append(f"Story {i}: missing story_type")
            if not story_dict.get("time"):
                errors.append(f"Story {i}: missing time")
            if not story_dict.get("uid"):
                errors.append(f"Story {i}: missing uid")
        
        # Validate context
        if not job.context.start_date:
            errors.append("Missing context.start_date")
        if not job.context.end_date:
            errors.append("Missing context.end_date")
        
        if errors:
            logger.error(
                "Job validation failed",
                job_id=job.job_id,
                error_count=len(errors),
                errors=errors,
            )
        else:
            logger.debug("Job validation passed", job_id=job.job_id)
        
        return errors
