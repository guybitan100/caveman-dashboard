
from datetime import date, datetime, timedelta

import pytest

from ai_generator.models import Entity
from ai_generator.models.entity import EntityCharacteristics, Gender
from ai_generator.models.phone_selection import DeviceType, SelectedPhone
from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.routine_pattern import (
    ActivityCategory,
    ActivityPriority,
    DailyRoutinePattern,
    RoutineActivity,
    WeeklyRoutinePattern,
)
from ai_generator.models.timeline import EventCategory, TimelineEvent
from ai_generator.routine_generation.conflict_resolver import ConflictResolver
from ai_generator.routine_generation.randomizer import RoutineRandomizer
from ai_generator.routine_generation.story_generator import RoutineStoryGenerator
from model.stories import StoryType

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def tech_savvy_entity() -> Entity:
    return Entity(
        entity_id="ent_tech",
        name="Alice Tech",
        characteristics=EntityCharacteristics(
            age=28,
            gender=Gender.FEMALE,
            occupation="Software Engineer",
            tech_savviness=9,
            social_activity=7,
            personality_traits=["analytical", "curious"],
        ),
        phone_numbers=["+1-555-0101"],
        emails=["alice@example.com"],
    )

@pytest.fixture
def low_tech_entity() -> Entity:
    return Entity(
        entity_id="ent_lowtech",
        name="Bob Traditional",
        characteristics=EntityCharacteristics(
            age=65,
            gender=Gender.MALE,
            occupation="Retired",
            tech_savviness=2,
            social_activity=3,
            personality_traits=["patient", "reserved"],
        ),
        phone_numbers=["+1-555-0102"],
        emails=["bob@example.com"],
    )

@pytest.fixture
def default_config() -> RoutineGenerationConfig:
    return RoutineGenerationConfig(
        enabled=True,
        density="heavy",
        timing_variation_minutes=30,
        duration_variation_pct=0.5,
        entity_aware_skip=True,
        adjust_for_timeline_events=True,
        timeline_event_buffer_minutes=60,
    )

@pytest.fixture
def sample_timeline_events(tech_savvy_entity: Entity) -> list[TimelineEvent]:
    return [
        TimelineEvent(
            event_id="evt_001",
            timestamp=datetime(2025, 1, 15, 10, 0),
            category=EventCategory.MEETING,
            involved_entities=[tech_savvy_entity.entity_id],
            primary_entity=tech_savvy_entity.entity_id,
            description="Important meeting",
            significance=8,
        ),
        TimelineEvent(
            event_id="evt_002",
            timestamp=datetime(2025, 1, 15, 14, 30),
            category=EventCategory.COMMUNICATION,
            involved_entities=[tech_savvy_entity.entity_id],
            primary_entity=tech_savvy_entity.entity_id,
            description="Phone call",
            significance=5,
        ),
        TimelineEvent(
            event_id="evt_003",
            timestamp=datetime(2025, 1, 16, 9, 0),
            category=EventCategory.LOCATION,
            involved_entities=[tech_savvy_entity.entity_id],
            primary_entity=tech_savvy_entity.entity_id,
            description="Arriving at work",
            significance=3,
        ),
    ]

@pytest.fixture
def sample_routine_activity() -> RoutineActivity:
    return RoutineActivity(
        activity_id="act_001",
        time="08:30",
        category=ActivityCategory.SOCIAL_MEDIA,
        story_type=StoryType.APP,
        priority=ActivityPriority.NORMAL,
        parameters={
            "app_category": "social",
            "duration_minutes": 15,
        },
        description="Morning social media check",
    )

@pytest.fixture
def sample_iphone(tech_savvy_entity: Entity) -> SelectedPhone:
    return SelectedPhone(
        entity_id=tech_savvy_entity.entity_id,
        entity_name=tech_savvy_entity.name,
        device_type=DeviceType.IPHONE,
        phone_number=tech_savvy_entity.phone_numbers[0],
        email=tech_savvy_entity.emails[0],
        start_date=date(2025, 1, 15),
        end_date=date(2025, 1, 17),
    )

# =============================================================================
# RoutineRandomizer Tests
# =============================================================================

class TestRoutineRandomizer:

    def test_should_never_skip_essential_activities(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        essential_activity = RoutineActivity(
            activity_id="act_essential",
            time="07:00",
            category=ActivityCategory.SYSTEM,
            story_type=StoryType.POWERING_EVENT,
            priority=ActivityPriority.ESSENTIAL,
            parameters={"event_type": "charging_end"},
            description="Morning charge complete",
        )

        # Test multiple times to ensure it never skips
        for _ in range(100):
            assert not randomizer.should_skip_activity(essential_activity)

    def test_tech_savvy_entity_skips_less(
        self,
        tech_savvy_entity: Entity,
        low_tech_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        tech_randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )
        low_tech_randomizer = RoutineRandomizer(
            config=default_config,
            entity=low_tech_entity,
            seed=42,
        )

        normal_activity = RoutineActivity(
            activity_id="act_normal",
            time="12:00",
            category=ActivityCategory.ENTERTAINMENT,
            story_type=StoryType.APP,
            priority=ActivityPriority.NORMAL,
            parameters={},
            description="Midday app usage",
        )

        # Count skips over many trials
        tech_skips = 0
        low_tech_skips = 0
        trials = 1000

        for i in range(trials):
            tech_randomizer.rng.seed(42 + i)
            low_tech_randomizer.rng.seed(42 + i)
            if tech_randomizer.should_skip_activity(normal_activity):
                tech_skips += 1
            if low_tech_randomizer.should_skip_activity(normal_activity):
                low_tech_skips += 1

        # Tech-savvy should skip less
        assert tech_skips < low_tech_skips

    def test_social_activity_affects_communication_skips(
        self,
        tech_savvy_entity: Entity,
        low_tech_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        # Create entities with same tech but different social activity
        high_social = Entity(
            entity_id="ent_high_social",
            name="Social Person",
            characteristics=EntityCharacteristics(
                tech_savviness=5,
                social_activity=9,
            ),
        )
        low_social = Entity(
            entity_id="ent_low_social",
            name="Quiet Person",
            characteristics=EntityCharacteristics(
                tech_savviness=5,
                social_activity=2,
            ),
        )

        high_randomizer = RoutineRandomizer(config=default_config, entity=high_social, seed=42)
        low_randomizer = RoutineRandomizer(config=default_config, entity=low_social, seed=42)

        social_activity = RoutineActivity(
            activity_id="act_social",
            time="19:00",
            category=ActivityCategory.COMMUNICATION,
            story_type=StoryType.APP,
            priority=ActivityPriority.OPTIONAL,
            parameters={},
            description="Evening social check",
        )

        high_skips = sum(
            1
            for i in range(1000)
            if (high_randomizer.rng.seed(42 + i) or True) and high_randomizer.should_skip_activity(social_activity)
        )
        low_skips = sum(
            1
            for i in range(1000)
            if (low_randomizer.rng.seed(42 + i) or True) and low_randomizer.should_skip_activity(social_activity)
        )

        assert high_skips < low_skips

    def test_time_randomization_within_bounds(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        base_date = date(2025, 1, 15)
        base_time = "12:00"

        for _ in range(100):
            result = randomizer.randomize_time(base_date, base_time)

            # Should stay within ±30 minutes
            expected_center = datetime(2025, 1, 15, 12, 0)
            delta = abs((result - expected_center).total_seconds())
            assert delta <= default_config.timing_variation_minutes * 60

            # Should stay on same day
            assert result.date() == base_date

    def test_time_clamped_to_day_boundaries(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        config = RoutineGenerationConfig(
            timing_variation_minutes=120,  # Large variation
        )
        randomizer = RoutineRandomizer(
            config=config,
            entity=tech_savvy_entity,
            seed=42,
        )

        base_date = date(2025, 1, 15)

        # Test early morning time
        for _ in range(50):
            result = randomizer.randomize_time(base_date, "00:30")
            assert result.date() == base_date

        # Test late night time
        for _ in range(50):
            result = randomizer.randomize_time(base_date, "23:30")
            assert result.date() == base_date

    def test_duration_randomization_within_bounds(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        base_duration = 20  # minutes

        for _ in range(100):
            result = randomizer.randomize_duration(base_duration)

            # Should be within ±50% (10-30 minutes)
            assert 10 <= result <= 30

            # Should be at least 1 minute
            assert result >= 1

    def test_duration_minimum_is_one(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        # Even with small base duration and max negative variation
        for _ in range(50):
            result = randomizer.randomize_duration(1)
            assert result >= 1

    def test_get_day_seed_is_consistent(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        test_date = date(2025, 1, 15)

        seed1 = randomizer.get_day_seed(test_date)
        seed2 = randomizer.get_day_seed(test_date)

        assert seed1 == seed2

    def test_get_day_seed_varies_by_date(
        self,
        tech_savvy_entity: Entity,
        default_config: RoutineGenerationConfig,
    ) -> None:
        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )

        seed_day1 = randomizer.get_day_seed(date(2025, 1, 15))
        seed_day2 = randomizer.get_day_seed(date(2025, 1, 16))

        assert seed_day1 != seed_day2

    def test_skip_disabled_when_config_disabled(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        config = RoutineGenerationConfig(entity_aware_skip=False)
        randomizer = RoutineRandomizer(
            config=config,
            entity=tech_savvy_entity,
            seed=42,
        )

        optional_activity = RoutineActivity(
            activity_id="act_opt",
            time="15:00",
            category=ActivityCategory.ENTERTAINMENT,
            story_type=StoryType.APP,
            priority=ActivityPriority.OPTIONAL,
            parameters={},
            description="Optional activity",
        )

        for _ in range(100):
            assert not randomizer.should_skip_activity(optional_activity)

# =============================================================================
# ConflictResolver Tests
# =============================================================================

class TestConflictResolver:

    def test_has_conflict_within_buffer(
        self,
        sample_timeline_events: list[TimelineEvent],
        default_config: RoutineGenerationConfig,
    ) -> None:
        resolver = ConflictResolver(
            timeline_events=sample_timeline_events,
            entity_id="ent_tech",
            config=default_config,
        )

        # Event at 10:00 with 60min buffer + 30min for high significance
        # Conflict window: 08:30 - 11:30
        conflict_time = datetime(2025, 1, 15, 9, 0)  # Within window
        assert resolver.has_conflict(conflict_time)

        safe_time = datetime(2025, 1, 15, 7, 0)  # Before window
        assert not resolver.has_conflict(safe_time)

    def test_no_conflict_outside_buffer(
        self,
        sample_timeline_events: list[TimelineEvent],
        default_config: RoutineGenerationConfig,
    ) -> None:
        resolver = ConflictResolver(
            timeline_events=sample_timeline_events,
            entity_id="ent_tech",
            config=default_config,
        )

        # Well outside any conflict windows
        safe_time = datetime(2025, 1, 15, 18, 0)
        assert not resolver.has_conflict(safe_time)

    def test_high_significance_extends_buffer(
        self,
        default_config: RoutineGenerationConfig,
    ) -> None:
        high_sig_event = TimelineEvent(
            event_id="evt_high",
            timestamp=datetime(2025, 1, 15, 12, 0),
            category=EventCategory.MEETING,
            involved_entities=["ent_test"],
            primary_entity="ent_test",
            description="Critical event",
            significance=9,  # High significance
        )

        low_sig_event = TimelineEvent(
            event_id="evt_low",
            timestamp=datetime(2025, 1, 15, 12, 0),
            category=EventCategory.OTHER,
            involved_entities=["ent_test"],
            primary_entity="ent_test",
            description="Minor event",
            significance=3,  # Low significance
        )

        high_resolver = ConflictResolver(
            timeline_events=[high_sig_event],
            entity_id="ent_test",
            config=default_config,
        )
        low_resolver = ConflictResolver(
            timeline_events=[low_sig_event],
            entity_id="ent_test",
            config=default_config,
        )

        # Time that should conflict with high sig but not low sig
        # High sig: buffer = 60 + 30 = 90 min each side (window: 10:30 - 13:30)
        # Low sig: buffer = 60 min each side (window: 11:00 - 13:00)
        test_time = datetime(2025, 1, 15, 10, 45)  # 75 min before event

        # High sig has larger window (60 + 30 = 90 buffer each side)
        assert high_resolver.has_conflict(test_time)

        # Low sig has standard window (60 buffer each side)
        assert not low_resolver.has_conflict(test_time)

    def test_only_considers_relevant_entity(
        self,
        default_config: RoutineGenerationConfig,
    ) -> None:
        events = [
            TimelineEvent(
                event_id="evt_alice",
                timestamp=datetime(2025, 1, 15, 10, 0),
                category=EventCategory.MEETING,
                involved_entities=["alice"],
                primary_entity="alice",
                description="Alice's meeting",
                significance=8,
            ),
            TimelineEvent(
                event_id="evt_bob",
                timestamp=datetime(2025, 1, 15, 10, 0),
                category=EventCategory.MEETING,
                involved_entities=["bob"],
                primary_entity="bob",
                description="Bob's meeting",
                significance=8,
            ),
        ]

        alice_resolver = ConflictResolver(
            timeline_events=events,
            entity_id="alice",
            config=default_config,
        )
        charlie_resolver = ConflictResolver(
            timeline_events=events,
            entity_id="charlie",
            config=default_config,
        )

        test_time = datetime(2025, 1, 15, 10, 0)

        assert alice_resolver.has_conflict(test_time)
        assert not charlie_resolver.has_conflict(test_time)

    def test_get_conflicting_event(
        self,
        sample_timeline_events: list[TimelineEvent],
        default_config: RoutineGenerationConfig,
    ) -> None:
        resolver = ConflictResolver(
            timeline_events=sample_timeline_events,
            entity_id="ent_tech",
            config=default_config,
        )

        conflict_time = datetime(2025, 1, 15, 10, 0)
        event = resolver.get_conflicting_event(conflict_time)

        assert event is not None
        assert event.event_id == "evt_001"

    def test_get_safe_time_slots(
        self,
        default_config: RoutineGenerationConfig,
    ) -> None:
        # Event at 12:00 with 60min buffer
        event = TimelineEvent(
            event_id="evt_noon",
            timestamp=datetime(2025, 1, 15, 12, 0),
            category=EventCategory.MEETING,
            involved_entities=["ent_test"],
            primary_entity="ent_test",
            description="Noon meeting",
            significance=5,  # +15 min extension
        )

        resolver = ConflictResolver(
            timeline_events=[event],
            entity_id="ent_test",
            config=default_config,
        )

        target = datetime(2025, 1, 15, 12, 0)
        slots = resolver.get_safe_time_slots(target, slot_duration_minutes=30)

        # Should have slots before and after the conflict window
        assert len(slots) >= 2

        # First slot should end before conflict
        # Conflict window: 10:45 - 13:15 (60 + 15 = 75 min buffer each side)
        first_slot_end = slots[0][1]
        assert first_slot_end.hour <= 10 or (first_slot_end.hour == 10 and first_slot_end.minute <= 45)

    def test_conflict_disabled_when_config_disabled(
        self,
        sample_timeline_events: list[TimelineEvent],
    ) -> None:
        config = RoutineGenerationConfig(adjust_for_timeline_events=False)
        resolver = ConflictResolver(
            timeline_events=sample_timeline_events,
            entity_id="ent_tech",
            config=config,
        )

        # Even at exact event time
        test_time = datetime(2025, 1, 15, 10, 0)
        assert not resolver.has_conflict(test_time)

# =============================================================================
# RoutineStoryGenerator Tests
# =============================================================================

class TestRoutineStoryGenerator:

    def test_generate_app_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_app",
            time="09:00",
            category=ActivityCategory.SOCIAL_MEDIA,
            story_type=StoryType.APP,
            priority=ActivityPriority.NORMAL,
            parameters={
                "app_category": "social",
                "duration_minutes": 10,
            },
            description="Social media check",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 9, 0),
            duration_minutes=10,
        )

        assert result is not None
        assert result.story_type == StoryType.APP
        assert result.time == datetime(2025, 1, 15, 9, 0)

    def test_generate_location_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_loc",
            time="08:00",
            category=ActivityCategory.LOCATION,
            story_type=StoryType.LOCATION,
            priority=ActivityPriority.ESSENTIAL,
            parameters={
                "location_type": "home",
                "category": "Home",
            },
            description="At home",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 8, 0),
        )

        assert result is not None
        assert result.story_type == StoryType.LOCATION
        assert hasattr(result, "coordinate")
        assert result.coordinate is not None

    def test_generate_web_history_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_web",
            time="10:00",
            category=ActivityCategory.ENTERTAINMENT,
            story_type=StoryType.WEB_HISTORY,
            priority=ActivityPriority.OPTIONAL,
            parameters={
                "category": "news",
            },
            description="Reading news",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 10, 0),
        )

        assert result is not None
        assert result.story_type == StoryType.WEB_HISTORY
        assert hasattr(result, "url")
        assert hasattr(result, "title")

    def test_generate_powering_event_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_power",
            time="07:00",
            category=ActivityCategory.SYSTEM,
            story_type=StoryType.POWERING_EVENT,
            priority=ActivityPriority.ESSENTIAL,
            parameters={
                "event_type": "charging_end",
                "typical_battery_level": 100,
            },
            description="Morning unplug",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 7, 0),
        )

        assert result is not None
        assert result.story_type == StoryType.POWERING_EVENT
        assert hasattr(result, "event_name")

    def test_generate_route_stories(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_route",
            time="08:30",
            category=ActivityCategory.LOCATION,
            story_type=StoryType.ROUTE,
            priority=ActivityPriority.ESSENTIAL,
            parameters={
                "from": "home",
                "to": "work",
                "duration_minutes": 30,
            },
            description="Commute to work",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 8, 30),
            duration_minutes=30,
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 2  # Start and end points

        # Check times
        assert result[0].time == datetime(2025, 1, 15, 8, 30)
        assert result[1].time == datetime(2025, 1, 15, 9, 0)  # 30 min later

    def test_location_coordinates_cached(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        coord1 = generator._get_location_coordinate("home")
        coord2 = generator._get_location_coordinate("home")

        assert coord1.latitude == coord2.latitude
        assert coord1.longitude == coord2.longitude

    def test_different_locations_have_different_coordinates(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        home = generator._get_location_coordinate("home")
        work = generator._get_location_coordinate("work")

        assert home.latitude != work.latitude or home.longitude != work.longitude

    def test_unsupported_story_type_returns_none(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_unsupported",
            time="12:00",
            category=ActivityCategory.COMMUNICATION,
            story_type=StoryType.EMAIL,  # Email is not yet supported for routine
            priority=ActivityPriority.NORMAL,
            parameters={},
            description="Email activity",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 12, 0),
        )

        assert result is None

    def test_generate_call_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_call",
            time="12:30",
            category=ActivityCategory.COMMUNICATION,
            story_type=StoryType.CALL,
            priority=ActivityPriority.NORMAL,
            parameters={
                "contact_category": "family",
                "direction": "outgoing",
                "call_type": "cellular",
                "duration_minutes": 5,
            },
            description="Call to Mom",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 12, 30),
            duration_minutes=5,
        )

        assert result is not None
        assert result.story_type == StoryType.CALL
        assert hasattr(result, "participant")
        assert hasattr(result, "direction")
        assert result.direction == "outgoing"
        assert hasattr(result, "duration")
        assert result.duration > 0

    def test_generate_sms_story(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_sms",
            time="14:00",
            category=ActivityCategory.COMMUNICATION,
            story_type=StoryType.INSTANT_MESSAGE,
            priority=ActivityPriority.OPTIONAL,
            parameters={
                "contact_category": "friends",
                "message_category": "casual",
                "status": "Read",
            },
            description="Text to friend",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 14, 0),
        )

        assert result is not None
        assert result.story_type == StoryType.INSTANT_MESSAGE
        assert hasattr(result, "sender")
        assert hasattr(result, "text")
        assert len(result.text) > 0
        assert hasattr(result, "status")

    def test_call_story_uses_contact_category(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # Create work call
        work_activity = RoutineActivity(
            activity_id="act_work_call",
            time="10:00",
            category=ActivityCategory.WORK,
            story_type=StoryType.CALL,
            priority=ActivityPriority.NORMAL,
            parameters={
                "contact_category": "work",
                "direction": "incoming",
            },
            description="Work call",
        )

        result = generator.generate_story(
            activity=work_activity,
            activity_time=datetime(2025, 1, 15, 10, 0),
        )

        assert result is not None
        # Participant should be a work contact phone number
        assert result.participant.startswith("+1-555-04")  # Work contacts range

    def test_sms_story_uses_message_templates(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        # Check that message comes from the template
        from ai_generator.routine_generation.story_generator import SMS_MESSAGE_TEMPLATES

        activity = RoutineActivity(
            activity_id="act_sms_work",
            time="09:00",
            category=ActivityCategory.WORK,
            story_type=StoryType.INSTANT_MESSAGE,
            priority=ActivityPriority.NORMAL,
            parameters={
                "contact_category": "work",
                "message_category": "work",
            },
            description="Work text",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 9, 0),
        )

        assert result is not None
        assert result.text in SMS_MESSAGE_TEMPLATES["work"]

    def test_device_type_affects_app_selection(
        self,
        tech_savvy_entity: Entity,
    ) -> None:
        iphone_generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )
        android_generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_email",
            time="09:00",
            category=ActivityCategory.WORK,
            story_type=StoryType.APP,
            priority=ActivityPriority.NORMAL,
            parameters={"app_category": "email"},
            description="Check email",
        )

        iphone_result = iphone_generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 9, 0),
        )
        android_result = android_generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 9, 0),
        )

        # Both should generate valid stories
        assert iphone_result is not None
        assert android_result is not None

        # App IDs should be platform-appropriate
        assert "apple" in iphone_result.app_id.lower() or "com.apple" in iphone_result.app_id
        assert "google" in android_result.app_id.lower() or "android" in android_result.app_id

# =============================================================================
# Entity Location Awareness Tests
# =============================================================================

class TestEntityLocationAwareness:

    def test_entity_with_explicit_location_uses_city_coordinates(self) -> None:
        # Create entity with explicit London location
        london_entity = Entity(
            entity_id="ent_london",
            name="London Person",
            characteristics=EntityCharacteristics(
                age=30,
                occupation="Analyst",
                location="London",
            ),
        )

        generator = RoutineStoryGenerator(
            entity=london_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # London coordinates are approximately (51.5074, -0.1278)
        home_coord = generator._get_location_coordinate("home")

        # Should be near London (within ~0.1 degrees)
        assert 51.4 < home_coord.latitude < 51.6
        assert -0.3 < home_coord.longitude < 0.0

    def test_entity_with_nyc_location(self) -> None:
        nyc_entity = Entity(
            entity_id="ent_nyc",
            name="NYC Person",
            characteristics=EntityCharacteristics(
                age=25,
                occupation="Developer",
                location="New York",
            ),
        )

        generator = RoutineStoryGenerator(
            entity=nyc_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        # NYC coordinates are approximately (40.7128, -74.0060)
        home_coord = generator._get_location_coordinate("home")

        # Should be near NYC (within ~0.1 degrees)
        assert 40.6 < home_coord.latitude < 40.9
        assert -74.2 < home_coord.longitude < -73.8

    def test_entity_without_location_defaults_to_nyc(self) -> None:
        no_location_entity = Entity(
            entity_id="ent_no_loc",
            name="No Location Person",
            characteristics=EntityCharacteristics(
                age=35,
                occupation="Teacher",
            ),
        )

        generator = RoutineStoryGenerator(
            entity=no_location_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # Should default to NYC
        home_coord = generator._get_location_coordinate("home")

        # Should be near NYC (default)
        assert 40.6 < home_coord.latitude < 40.9
        assert -74.2 < home_coord.longitude < -73.8

    def test_location_extracted_from_background(self) -> None:
        background_entity = Entity(
            entity_id="ent_bg",
            name="Background Person",
            characteristics=EntityCharacteristics(
                age=40,
                occupation="Consultant",
                background="Born and raised in Chicago, works at a downtown firm.",
            ),
        )

        generator = RoutineStoryGenerator(
            entity=background_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        # Chicago coordinates are approximately (41.8781, -87.6298)
        home_coord = generator._get_location_coordinate("home")

        # Should be near Chicago
        assert 41.7 < home_coord.latitude < 42.0
        assert -87.8 < home_coord.longitude < -87.4

    def test_different_location_types_have_consistent_offsets(self) -> None:
        tokyo_entity = Entity(
            entity_id="ent_tokyo",
            name="Tokyo Person",
            characteristics=EntityCharacteristics(
                location="Tokyo",
            ),
        )

        generator = RoutineStoryGenerator(
            entity=tokyo_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # Tokyo coordinates are approximately (35.6762, 139.6503)
        home = generator._get_location_coordinate("home")
        work = generator._get_location_coordinate("work")
        gym = generator._get_location_coordinate("gym")

        # All should be in Tokyo area
        for coord in [home, work, gym]:
            assert 35.5 < coord.latitude < 36.0
            assert 139.4 < coord.longitude < 140.0

        # Work should be different from home
        assert home.latitude != work.latitude or home.longitude != work.longitude

    def test_location_coordinates_cached(self) -> None:
        entity = Entity(
            entity_id="ent_cache",
            name="Cache Test",
            characteristics=EntityCharacteristics(location="Seattle"),
        )

        generator = RoutineStoryGenerator(
            entity=entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        # Get home twice
        home1 = generator._get_location_coordinate("home")
        home2 = generator._get_location_coordinate("home")

        # Should be exactly the same (cached)
        assert home1.latitude == home2.latitude
        assert home1.longitude == home2.longitude

    def test_extract_location_from_text_finds_cities(self) -> None:
        entity = Entity(
            entity_id="ent_test",
            name="Test",
            characteristics=EntityCharacteristics(),
        )

        generator = RoutineStoryGenerator(
            entity=entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # Test various city mentions
        assert generator._extract_location_from_text("Lives in San Francisco Bay Area") == "san francisco"
        assert generator._extract_location_from_text("Moved to London last year") == "london"
        assert generator._extract_location_from_text("Born in Tokyo, Japan") == "tokyo"
        assert generator._extract_location_from_text("No city mentioned here") is None

    def test_partial_city_name_match(self) -> None:
        entity = Entity(
            entity_id="ent_partial",
            name="Partial Match",
            characteristics=EntityCharacteristics(
                location="Los Angeles, California",  # Full string with state
            ),
        )

        generator = RoutineStoryGenerator(
            entity=entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        # LA coordinates are approximately (34.0522, -118.2437)
        home = generator._get_location_coordinate("home")

        # Should be near LA
        assert 33.9 < home.latitude < 34.2
        assert -118.5 < home.longitude < -118.0

    def test_city_abbreviations_work(self) -> None:
        sf_entity = Entity(
            entity_id="ent_sf",
            name="SF Person",
            characteristics=EntityCharacteristics(location="SF"),
        )

        generator = RoutineStoryGenerator(
            entity=sf_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # SF coordinates are approximately (37.7749, -122.4194)
        home = generator._get_location_coordinate("home")

        # Should be near SF
        assert 37.6 < home.latitude < 37.9
        assert -122.6 < home.longitude < -122.2

    def test_location_story_uses_entity_location(self) -> None:
        sydney_entity = Entity(
            entity_id="ent_sydney",
            name="Sydney Person",
            characteristics=EntityCharacteristics(location="Sydney"),
        )

        generator = RoutineStoryGenerator(
            entity=sydney_entity,
            device_type=DeviceType.ANDROID,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_loc",
            time="09:00",
            category=ActivityCategory.LOCATION,
            story_type=StoryType.LOCATION,
            priority=ActivityPriority.NORMAL,
            parameters={"location_type": "work", "category": "Work"},
            description="At work",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 9, 0),
        )

        assert result is not None
        # Sydney coordinates are approximately (-33.8688, 151.2093)
        assert -34.0 < result.coordinate.latitude < -33.7
        assert 150.9 < result.coordinate.longitude < 151.5

    def test_route_story_uses_entity_location(self) -> None:
        berlin_entity = Entity(
            entity_id="ent_berlin",
            name="Berlin Person",
            characteristics=EntityCharacteristics(location="Berlin"),
        )

        generator = RoutineStoryGenerator(
            entity=berlin_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        activity = RoutineActivity(
            activity_id="act_route",
            time="08:30",
            category=ActivityCategory.LOCATION,
            story_type=StoryType.ROUTE,
            priority=ActivityPriority.ESSENTIAL,
            parameters={"from": "home", "to": "work", "duration_minutes": 30},
            description="Commute",
        )

        result = generator.generate_story(
            activity=activity,
            activity_time=datetime(2025, 1, 15, 8, 30),
            duration_minutes=30,
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 2

        # Berlin coordinates are approximately (52.5200, 13.4050)
        for loc in result:
            assert 52.3 < loc.coordinate.latitude < 52.7
            assert 13.2 < loc.coordinate.longitude < 13.6

# =============================================================================
# Integration Tests
# =============================================================================

class TestRoutineGenerationIntegration:

    @pytest.fixture
    def sample_weekly_pattern(self) -> WeeklyRoutinePattern:
        monday_activities = [
            RoutineActivity(
                activity_id="mon_001",
                time="07:00",
                category=ActivityCategory.SYSTEM,
                story_type=StoryType.POWERING_EVENT,
                priority=ActivityPriority.ESSENTIAL,
                parameters={"event_type": "charging_end"},
                description="Morning unplug",
            ),
            RoutineActivity(
                activity_id="mon_002",
                time="07:30",
                category=ActivityCategory.SOCIAL_MEDIA,
                story_type=StoryType.APP,
                priority=ActivityPriority.NORMAL,
                parameters={"app_category": "social"},
                description="Morning social check",
            ),
            RoutineActivity(
                activity_id="mon_003",
                time="08:30",
                category=ActivityCategory.LOCATION,
                story_type=StoryType.ROUTE,
                priority=ActivityPriority.ESSENTIAL,
                parameters={"from": "home", "to": "work", "duration_minutes": 30},
                description="Commute to work",
            ),
        ]

        return WeeklyRoutinePattern(
            entity_id="ent_tech",
            entity_name="Alice Tech",
            patterns={
                "monday": DailyRoutinePattern(
                    day_of_week="monday",
                    activities=monday_activities,
                ),
                "tuesday": DailyRoutinePattern(
                    day_of_week="tuesday",
                    activities=monday_activities,  # Same for simplicity
                ),
            },
            generated_at=datetime.now().isoformat(),
            date_range_start="2025-01-13",
            date_range_end="2025-01-19",
            summary="Tech worker routine",
        )

    def test_full_day_story_generation(
        self,
        tech_savvy_entity: Entity,
        sample_weekly_pattern: WeeklyRoutinePattern,
        default_config: RoutineGenerationConfig,
    ) -> None:
        from ai_generator.routine_generation.generator import _generate_day_stories

        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )
        conflict_resolver = ConflictResolver(
            timeline_events=[],
            entity_id=tech_savvy_entity.entity_id,
            config=default_config,
        )
        story_generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        # Monday is day 0 (weekday())
        monday = date(2025, 1, 13)
        assert monday.weekday() == 0

        stories = _generate_day_stories(
            current_date=monday,
            pattern=sample_weekly_pattern,
            randomizer=randomizer,
            conflict_resolver=conflict_resolver,
            story_generator=story_generator,
        )

        # Should generate stories (exact count varies due to skips and route expansion)
        assert len(stories) >= 2  # At least essential activities

        # All stories should be on the correct date
        for story in stories:
            assert story.time.date() == monday

    def test_stories_respect_timeline_conflicts(
        self,
        tech_savvy_entity: Entity,
        sample_weekly_pattern: WeeklyRoutinePattern,
        default_config: RoutineGenerationConfig,
    ) -> None:
        from ai_generator.routine_generation.generator import _generate_day_stories

        # Create a timeline event at commute time
        timeline_events = [
            TimelineEvent(
                event_id="evt_conflict",
                timestamp=datetime(2025, 1, 13, 8, 30),
                category=EventCategory.MEETING,
                involved_entities=[tech_savvy_entity.entity_id],
                primary_entity=tech_savvy_entity.entity_id,
                description="Emergency meeting",
                significance=9,
            )
        ]

        randomizer = RoutineRandomizer(
            config=default_config,
            entity=tech_savvy_entity,
            seed=42,
        )
        conflict_resolver = ConflictResolver(
            timeline_events=timeline_events,
            entity_id=tech_savvy_entity.entity_id,
            config=default_config,
        )
        story_generator = RoutineStoryGenerator(
            entity=tech_savvy_entity,
            device_type=DeviceType.IPHONE,
            seed=42,
        )

        monday = date(2025, 1, 13)
        stories = _generate_day_stories(
            current_date=monday,
            pattern=sample_weekly_pattern,
            randomizer=randomizer,
            conflict_resolver=conflict_resolver,
            story_generator=story_generator,
        )

        # The 08:30 commute should be skipped due to conflict
        commute_stories = [
            s for s in stories if hasattr(s, "user_description") and "Route" in str(s.user_description)
        ]

        # With high significance event at 08:30, the commute should be skipped
        assert len(commute_stories) == 0

    def test_deterministic_with_same_seed(
        self,
        tech_savvy_entity: Entity,
        sample_weekly_pattern: WeeklyRoutinePattern,
        default_config: RoutineGenerationConfig,
    ) -> None:
        from ai_generator.routine_generation.generator import _generate_day_stories

        def generate_with_seed(seed: int) -> list:
            randomizer = RoutineRandomizer(
                config=default_config,
                entity=tech_savvy_entity,
                seed=seed,
            )
            conflict_resolver = ConflictResolver(
                timeline_events=[],
                entity_id=tech_savvy_entity.entity_id,
                config=default_config,
            )
            story_generator = RoutineStoryGenerator(
                entity=tech_savvy_entity,
                device_type=DeviceType.IPHONE,
                seed=seed,
            )

            return _generate_day_stories(
                current_date=date(2025, 1, 13),
                pattern=sample_weekly_pattern,
                randomizer=randomizer,
                conflict_resolver=conflict_resolver,
                story_generator=story_generator,
            )

        stories1 = generate_with_seed(42)
        stories2 = generate_with_seed(42)
        stories3 = generate_with_seed(99)

        # Same seed should produce same results
        assert len(stories1) == len(stories2)
        for s1, s2 in zip(stories1, stories2):
            assert s1.time == s2.time
            assert s1.story_type == s2.story_type

        # Different seed may produce different results
        # (Not guaranteed, but likely with OPTIONAL activities)
        # Just check it runs without error
        assert stories3 is not None
