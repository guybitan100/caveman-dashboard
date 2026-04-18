"""Timeline event conflict detection and resolution."""

from datetime import datetime, timedelta

from ai_generator.models.routine_config import RoutineGenerationConfig
from ai_generator.models.timeline import TimelineEvent


class ConflictResolver:
    """Resolves conflicts between routine activities and timeline events.

    Routine activities should be paused/adjusted when significant
    storyline events occur to maintain realism.
    """

    def __init__(
        self,
        timeline_events: list[TimelineEvent],
        entity_id: str,
        config: RoutineGenerationConfig,
    ):
        """Initialize the conflict resolver.

        Args:
            timeline_events: All timeline events from the story
            entity_id: The entity ID to check conflicts for
            config: Routine generation configuration
        """
        self.timeline_events = timeline_events
        self.entity_id = entity_id
        self.config = config
        self._build_conflict_windows()

    def _build_conflict_windows(self) -> None:
        """Build time windows where routines should be paused/adjusted."""
        self.conflict_windows: list[tuple[datetime, datetime, TimelineEvent]] = []

        if not self.config.adjust_for_timeline_events:
            return

        buffer_minutes = self.config.timeline_event_buffer_minutes

        for event in self.timeline_events:
            # Only consider events involving this entity
            if self.entity_id not in event.involved_entities:
                continue

            # Create buffer window before and after event
            start = event.timestamp - timedelta(minutes=buffer_minutes)
            end = event.timestamp + timedelta(minutes=buffer_minutes)

            # Extend window based on event significance
            # Higher significance events get longer windows
            if event.significance >= 8:
                # Very significant events - extend buffer
                start -= timedelta(minutes=30)
                end += timedelta(minutes=30)
            elif event.significance >= 5:
                # Moderately significant - slight extension
                start -= timedelta(minutes=15)
                end += timedelta(minutes=15)

            self.conflict_windows.append((start, end, event))

    def has_conflict(self, routine_time: datetime) -> bool:
        """
        Check if a routine activity conflicts with timeline events.

        Args:
            routine_time: When the routine activity would occur

        Returns:
            True if there's a conflict, False otherwise
        """
        if not self.config.adjust_for_timeline_events:
            return False

        for start, end, _event in self.conflict_windows:
            if start <= routine_time <= end:
                return True

        return False

    def get_conflicting_event(self, routine_time: datetime) -> TimelineEvent | None:
        """
        Get the timeline event that conflicts with a routine time.

        Args:
            routine_time: When the routine activity would occur

        Returns:
            The conflicting TimelineEvent, or None if no conflict
        """
        if not self.config.adjust_for_timeline_events:
            return None

        for start, end, event in self.conflict_windows:
            if start <= routine_time <= end:
                return event

        return None

    def should_skip_routine(self, routine_time: datetime) -> bool:
        """
        Determine if a routine should be skipped due to timeline event.

        This is the main method to use for conflict checking. It determines
        whether a routine activity should be skipped entirely based on
        the timeline events.

        Args:
            routine_time: When the routine activity would occur

        Returns:
            True if the routine should be skipped, False otherwise
        """
        return self.has_conflict(routine_time)

    def get_safe_time_slots(
        self,
        target_date: datetime,
        slot_duration_minutes: int = 30,
    ) -> list[tuple[datetime, datetime]]:
        """
        Get time slots on a given date that are safe from conflicts.

        Useful for finding available times for optional activities.

        Args:
            target_date: The date to find safe slots for
            slot_duration_minutes: Minimum slot duration in minutes

        Returns:
            List of (start, end) tuples representing safe time slots
        """
        # Start with full day availability (6 AM to 11 PM)
        day_start = datetime.combine(target_date.date(), datetime.min.time().replace(hour=6))
        day_end = datetime.combine(target_date.date(), datetime.min.time().replace(hour=23))

        # Collect all conflict periods for this day
        conflicts = []
        for start, end, _event in self.conflict_windows:
            if start.date() <= target_date.date() <= end.date():
                # Clamp to day boundaries
                conflict_start = max(start, day_start)
                conflict_end = min(end, day_end)
                if conflict_start < conflict_end:
                    conflicts.append((conflict_start, conflict_end))

        # Sort conflicts by start time
        conflicts.sort(key=lambda x: x[0])

        # Build safe slots between conflicts
        safe_slots = []
        current_start = day_start

        for conflict_start, conflict_end in conflicts:
            if conflict_start > current_start:
                slot_duration = (conflict_start - current_start).total_seconds() / 60
                if slot_duration >= slot_duration_minutes:
                    safe_slots.append((current_start, conflict_start))
            current_start = max(current_start, conflict_end)

        # Add final slot if there's time after last conflict
        if day_end > current_start:
            slot_duration = (day_end - current_start).total_seconds() / 60
            if slot_duration >= slot_duration_minutes:
                safe_slots.append((current_start, day_end))

        return safe_slots
