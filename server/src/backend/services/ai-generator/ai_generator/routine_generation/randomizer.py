"""Randomization engine for routine pattern instantiation."""

import random
from datetime import date, datetime, time, timedelta
from typing import Any

from ai_generator.models import Entity
from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.routine_pattern import ActivityPriority, RoutineActivity


class RoutineRandomizer:
    """Handles randomization of routine activities.

    Uses entity characteristics to make skip probabilities and variations
    personalized to the individual.
    """

    def __init__(
        self,
        config: RoutineGenerationConfig,
        entity: Entity,
        seed: int | None = None,
    ):
        """Initialize the randomizer.

        Args:
            config: Routine generation configuration
            entity: Entity for personality-aware randomization
            seed: Optional seed for reproducibility
        """
        self.config = config
        self.entity = entity
        self.rng = random.Random(seed)

    def should_skip_activity(self, activity: RoutineActivity) -> bool:
        """
        Determine if an activity should be skipped based on priority and entity traits.

        Uses entity characteristics to vary skip probability:
        - Higher tech_savviness = fewer skips (more consistent usage)
        - Higher social_activity = fewer communication/social skips

        Args:
            activity: The routine activity to evaluate

        Returns:
            True if the activity should be skipped, False otherwise
        """
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
        """
        Randomize a time with liberal variation (±30 minutes by default).

        Args:
            base_date: The date for the activity
            base_time_str: Time in "HH:MM" format

        Returns:
            Randomized datetime
        """
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
        """
        Randomize duration with liberal variation (±50% by default).

        Args:
            base_duration_minutes: Base duration in minutes

        Returns:
            Randomized duration in minutes (minimum 1)
        """
        if base_duration_minutes <= 0:
            return 1

        variation_pct = self.rng.uniform(
            -self.config.duration_variation_pct,
            self.config.duration_variation_pct,
        )

        randomized = int(base_duration_minutes * (1 + variation_pct))
        return max(1, randomized)  # Minimum 1 minute

    def select_from_options(self, options: list[Any]) -> Any:
        """Randomly select from a list of options.

        Args:
            options: List of options to choose from

        Returns:
            Randomly selected option
        """
        if not options:
            return None
        return self.rng.choice(options)

    def randomize_battery_level(self, base_level: int, event_type: str) -> int:
        """
        Randomize battery level with realistic variation.

        Args:
            base_level: Base battery level (0-100)
            event_type: Type of powering event (charging_start, charging_end)

        Returns:
            Randomized battery level (0-100)
        """
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
        """Get a consistent seed for a specific day.

        This ensures the same day across different weeks has similar
        but not identical patterns.

        Args:
            current_date: The date to generate seed for

        Returns:
            Deterministic seed based on date and entity
        """
        # Combine date ordinal with entity ID hash for unique but consistent seed
        date_component = current_date.toordinal()
        entity_component = hash(self.entity.entity_id) % 10000
        return date_component + entity_component
