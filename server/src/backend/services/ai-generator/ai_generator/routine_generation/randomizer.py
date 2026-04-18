
import random
from datetime import date, datetime, time, timedelta
from typing import Any

from ai_generator.models import Entity
from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.routine_pattern import ActivityPriority, RoutineActivity


class RoutineRandomizer:

    def __init__(
        self,
        config: RoutineGenerationConfig,
        entity: Entity,
        seed: int | None = None,
    ):
        self.config = config
        self.entity = entity
        self.rng = random.Random(seed)

    def should_skip_activity(self, activity: RoutineActivity) -> bool:
        if not self.config.entity_aware_skip:
            return False

        if activity.priority == ActivityPriority.ESSENTIAL:
            return False  # Never skip essential activities

        # Base skip probabilities by priority
        base_skip_prob = {
            ActivityPriority.NORMAL: 0.15,  # 15% base skip rate
            ActivityPriority.OPTIONAL: 0.40,  # 40% base skip rate
        }

        skip_prob = base_skip_prob.get(activity.priority, 0.15)

        # Adjust based on tech_savviness (higher = more consistent, fewer skips)
        tech_factor = (10 - self.entity.characteristics.tech_savviness) / 20
        skip_prob += tech_factor * 0.15  # Up to +7.5% for low tech savvy

        # Adjust based on social_activity for social/communication activities
        if activity.category in ["social_media", "communication"]:
            social_factor = (10 - self.entity.characteristics.social_activity) / 20
            skip_prob += social_factor * 0.20  # Up to +10% for low social activity

        # Clamp probability to reasonable range
        skip_prob = max(0.0, min(0.8, skip_prob))

        return self.rng.random() < skip_prob

    def randomize_time(
        self,
        base_date: date,
        base_time_str: str,
    ) -> datetime:
        # Parse the time string
        try:
            base_time = datetime.strptime(base_time_str, "%H:%M").time()
        except ValueError:
            # Fallback to noon if parsing fails
            base_time = time(12, 0)

        base_dt = datetime.combine(base_date, base_time)

        # Apply liberal variation (±30 minutes default)
        variation_minutes = self.rng.randint(
            -self.config.timing_variation_minutes,
            self.config.timing_variation_minutes,
        )

        result = base_dt + timedelta(minutes=variation_minutes)

        # Ensure time stays within same day (clamp to 00:00 - 23:59)
        if result.date() < base_date:
            result = datetime.combine(base_date, time(0, 0))
        elif result.date() > base_date:
            result = datetime.combine(base_date, time(23, 59))

        return result

    def randomize_duration(self, base_duration_minutes: int) -> int:
        if base_duration_minutes <= 0:
            return 1

        variation_pct = self.rng.uniform(
            -self.config.duration_variation_pct,
            self.config.duration_variation_pct,
        )

        randomized = int(base_duration_minutes * (1 + variation_pct))
        return max(1, randomized)  # Minimum 1 minute

    def select_from_options(self, options: list[Any]) -> Any:
        if not options:
            return None
        return self.rng.choice(options)

    def randomize_battery_level(self, base_level: int, event_type: str) -> int:
        # Add variation of ±15%
        variation = self.rng.randint(-15, 15)
        level = base_level + variation

        # Clamp to realistic ranges based on event type
        if event_type == "charging_start":
            # Typically start charging when low (5-45%)
            level = max(5, min(45, level))
        elif event_type == "charging_end":
            # Typically end charging near full (85-100%)
            level = max(85, min(100, level))
        else:
            level = max(0, min(100, level))

        return level

    def get_day_seed(self, current_date: date) -> int:
        # Combine date ordinal with entity ID hash for unique but consistent seed
        date_component = current_date.toordinal()
        entity_component = hash(self.entity.entity_id) % 10000
        return date_component + entity_component
