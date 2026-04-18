"""Story generators for converting routine activities to concrete StoryData objects."""

import logging
import random
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from ai_generator.models import (
    AppStoryData,
    CallStoryData,
    Coordinate,
    Entity,
    InstantMessageStoryData,
    LocationStoryData,
    PoweringEventStoryData,
    WebHistoryStoryData,
)
from model.stories import _AppInfo
from ai_generator.models.app_registry import (
    AppCategory,
    AppRegistry,
    get_app_registry,
)
from ai_generator.models.phone_selection import DeviceType
from ai_generator.models.routine_pattern import ActivityCategory, RoutineActivity
from model.stories import StoryData, StoryType

logger = logging.getLogger(__name__)


# City center coordinates for location-aware generation
# Maps city names (lowercased) to their approximate center coordinates
CITY_COORDINATES: dict[str, tuple[float, float]] = {
    # US Major Cities
    "new york": (40.7128, -74.0060),
    "nyc": (40.7128, -74.0060),
    "los angeles": (34.0522, -118.2437),
    "la": (34.0522, -118.2437),
    "chicago": (41.8781, -87.6298),
    "houston": (29.7604, -95.3698),
    "phoenix": (33.4484, -112.0740),
    "philadelphia": (39.9526, -75.1652),
    "san antonio": (29.4241, -98.4936),
    "san diego": (32.7157, -117.1611),
    "dallas": (32.7767, -96.7970),
    "san jose": (37.3382, -121.8863),
    "austin": (30.2672, -97.7431),
    "jacksonville": (30.3322, -81.6557),
    "san francisco": (37.7749, -122.4194),
    "sf": (37.7749, -122.4194),
    "seattle": (47.6062, -122.3321),
    "denver": (39.7392, -104.9903),
    "boston": (42.3601, -71.0589),
    "miami": (25.7617, -80.1918),
    "atlanta": (33.7490, -84.3880),
    "washington": (38.9072, -77.0369),
    "dc": (38.9072, -77.0369),
    "washington dc": (38.9072, -77.0369),
    "portland": (45.5152, -122.6784),
    "las vegas": (36.1699, -115.1398),
    "detroit": (42.3314, -83.0458),
    "minneapolis": (44.9778, -93.2650),
    # International Cities
    "london": (51.5074, -0.1278),
    "paris": (48.8566, 2.3522),
    "tokyo": (35.6762, 139.6503),
    "berlin": (52.5200, 13.4050),
    "sydney": (-33.8688, 151.2093),
    "toronto": (43.6532, -79.3832),
    "vancouver": (49.2827, -123.1207),
    "melbourne": (-37.8136, 144.9631),
    "singapore": (1.3521, 103.8198),
    "hong kong": (22.3193, 114.1694),
    "tel aviv": (32.0853, 34.7818),
    "amsterdam": (52.3676, 4.9041),
    "dublin": (53.3498, -6.2603),
    "zurich": (47.3769, 8.5417),
}


# Pre-defined location coordinates for routine locations
# These are placeholder coordinates - in production, would use real location data
ROUTINE_LOCATION_PRESETS: dict[str, dict[str, Any]] = {
    "home": {
        "category": "Home",
        "lat_base": 40.7128,
        "lon_base": -74.0060,
        "variance": 0.0001,
    },
    "work": {
        "category": "Work",
        "lat_base": 40.7580,
        "lon_base": -73.9855,
        "variance": 0.0005,
    },
    "gym": {
        "category": "Gym",
        "lat_base": 40.7489,
        "lon_base": -73.9680,
        "variance": 0.0002,
    },
    "coffee_shop": {
        "category": "Food & Beverage",
        "lat_base": 40.7505,
        "lon_base": -73.9934,
        "variance": 0.001,
    },
    "grocery": {
        "category": "Retail",
        "lat_base": 40.7420,
        "lon_base": -73.9890,
        "variance": 0.002,
    },
    "restaurant": {
        "category": "Food & Beverage",
        "lat_base": 40.7614,
        "lon_base": -73.9776,
        "variance": 0.003,
    },
    "mall": {
        "category": "Retail",
        "lat_base": 40.7590,
        "lon_base": -73.9845,
        "variance": 0.001,
    },
    "park": {
        "category": "Recreation",
        "lat_base": 40.7812,
        "lon_base": -73.9665,
        "variance": 0.005,
    },
}

# Web history URL templates by category
WEB_HISTORY_TEMPLATES: dict[str, list[dict[str, str]]] = {
    "news": [
        {"url": "https://www.cnn.com/", "title": "CNN - Breaking News"},
        {"url": "https://www.bbc.com/news", "title": "BBC News"},
        {"url": "https://www.nytimes.com/", "title": "The New York Times"},
        {"url": "https://www.reuters.com/", "title": "Reuters News"},
        {"url": "https://news.google.com/", "title": "Google News"},
    ],
    "social": [
        {"url": "https://www.facebook.com/", "title": "Facebook"},
        {"url": "https://www.instagram.com/", "title": "Instagram"},
        {"url": "https://twitter.com/", "title": "X (Twitter)"},
        {"url": "https://www.linkedin.com/", "title": "LinkedIn"},
        {"url": "https://www.reddit.com/", "title": "Reddit"},
    ],
    "shopping": [
        {"url": "https://www.amazon.com/", "title": "Amazon.com"},
        {"url": "https://www.ebay.com/", "title": "eBay"},
        {"url": "https://www.target.com/", "title": "Target"},
        {"url": "https://www.walmart.com/", "title": "Walmart"},
    ],
    "entertainment": [
        {"url": "https://www.youtube.com/", "title": "YouTube"},
        {"url": "https://www.netflix.com/", "title": "Netflix"},
        {"url": "https://www.spotify.com/", "title": "Spotify"},
        {"url": "https://www.twitch.tv/", "title": "Twitch"},
    ],
    "work": [
        {"url": "https://mail.google.com/", "title": "Gmail"},
        {"url": "https://calendar.google.com/", "title": "Google Calendar"},
        {"url": "https://docs.google.com/", "title": "Google Docs"},
        {"url": "https://www.notion.so/", "title": "Notion"},
        {"url": "https://www.slack.com/", "title": "Slack"},
    ],
    "research": [
        {"url": "https://www.google.com/search", "title": "Google Search"},
        {"url": "https://www.wikipedia.org/", "title": "Wikipedia"},
        {"url": "https://stackoverflow.com/", "title": "Stack Overflow"},
    ],
}

# Routine contact templates for calls and SMS
# These represent generic contacts for routine communications
ROUTINE_CONTACTS: dict[str, list[dict[str, str]]] = {
    "family": [
        {"name": "Mom", "phone": "+1-555-0201"},
        {"name": "Dad", "phone": "+1-555-0202"},
        {"name": "Spouse", "phone": "+1-555-0203"},
        {"name": "Sibling", "phone": "+1-555-0204"},
    ],
    "friends": [
        {"name": "Best Friend", "phone": "+1-555-0301"},
        {"name": "College Friend", "phone": "+1-555-0302"},
        {"name": "Neighbor", "phone": "+1-555-0303"},
        {"name": "Gym Buddy", "phone": "+1-555-0304"},
    ],
    "work": [
        {"name": "Boss", "phone": "+1-555-0401"},
        {"name": "Coworker", "phone": "+1-555-0402"},
        {"name": "Client", "phone": "+1-555-0403"},
        {"name": "Assistant", "phone": "+1-555-0404"},
    ],
    "service": [
        {"name": "Doctor's Office", "phone": "+1-555-0501"},
        {"name": "Dentist", "phone": "+1-555-0502"},
        {"name": "Bank", "phone": "+1-555-0503"},
        {"name": "Insurance", "phone": "+1-555-0504"},
    ],
}

# SMS message templates by category
SMS_MESSAGE_TEMPLATES: dict[str, list[str]] = {
    "casual": [
        "Hey, how are you?",
        "What's up?",
        "See you later!",
        "Sounds good!",
        "OK 👍",
        "On my way",
        "Running late, be there soon",
        "Thanks!",
    ],
    "family": [
        "Love you!",
        "Call me when you get a chance",
        "What time is dinner?",
        "Just checking in",
        "Have a great day!",
        "Miss you",
    ],
    "work": [
        "In a meeting, will call back",
        "Running 5 mins late",
        "Got your email, will review",
        "See you at the office",
        "Quick question about the project",
        "Can we reschedule?",
    ],
    "plans": [
        "What time should we meet?",
        "I'm here",
        "Table for 2 at 7",
        "See you there!",
        "Can we do tomorrow instead?",
        "Just left",
    ],
}


class RoutineStoryGenerator:
    """Generates concrete StoryData objects from routine activities."""

    def __init__(
        self,
        entity: Entity,
        device_type: DeviceType,
        seed: int | None = None,
    ):
        """Initialize the story generator.

        Args:
            entity: The entity owning the phone
            device_type: Type of device (affects app selection)
            seed: Optional random seed for reproducibility
        """
        self.entity = entity
        self.device_type = device_type
        self.rng = random.Random(seed)
        self.app_registry: AppRegistry = get_app_registry()

        # Cache for location coordinates (to maintain consistency)
        self._location_cache: dict[str, Coordinate] = {}

        # Determine base coordinates from entity location
        self._base_lat, self._base_lon = self._get_base_coordinates_for_entity()

    def generate_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
        duration_minutes: int | None = None,
    ) -> StoryData | Sequence[StoryData] | None:
        """
        Generate a StoryData object from a routine activity.

        Args:
            activity: The routine activity to convert
            activity_time: The randomized time for this activity
            duration_minutes: Optional randomized duration

        Returns:
            StoryData object, Sequence of StoryData (for routes), or None if generation fails
        """
        story_type = activity.story_type

        try:
            if story_type == StoryType.APP:
                return self._generate_app_story(activity, activity_time, duration_minutes)
            elif story_type == StoryType.LOCATION:
                return self._generate_location_story(activity, activity_time)
            elif story_type == StoryType.WEB_HISTORY:
                return self._generate_web_history_story(activity, activity_time)
            elif story_type == StoryType.POWERING_EVENT:
                return self._generate_powering_event_story(activity, activity_time)
            elif story_type == StoryType.ROUTE:
                # Routes require special handling (multiple locations)
                return self._generate_route_stories(activity, activity_time, duration_minutes)
            elif story_type == StoryType.CALL:
                return self._generate_call_story(activity, activity_time, duration_minutes)
            elif story_type == StoryType.INSTANT_MESSAGE:
                return self._generate_sms_story(activity, activity_time)
            else:
                logger.warning(f"Unsupported story type for routine: {story_type}")
                return None
        except Exception as e:
            logger.error(f"Failed to generate story for activity {activity.activity_id}: {e}")
            return None

    def _generate_app_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
        duration_minutes: int | None = None,
    ) -> AppStoryData:
        """Generate an app usage story."""
        params = activity.parameters

        # Get app category from parameters
        app_category_str = params.get("app_category", "social")
        app_hint = params.get("app_hint", None)

        # Map string category to AppCategory enum
        category_map = {
            "social": AppCategory.SOCIAL,
            "productivity": AppCategory.SYSTEM,
            "entertainment": AppCategory.BROWSER,
            "communication": AppCategory.MESSAGING,
            "health": AppCategory.SYSTEM,
            "news": AppCategory.BROWSER,
            "email": AppCategory.EMAIL,
        }

        app_category = category_map.get(app_category_str, AppCategory.SOCIAL)

        # Try to find app by hint first, then by category
        app_info = None
        if app_hint and isinstance(app_hint, str):
            app_info = self.app_registry.get_messaging_app(
                device_type=self.device_type,
                app_name_hint=app_hint,
            )

        if not app_info:
            app_info = self.app_registry.get_default_app(app_category, self.device_type)

        if not app_info:
            # Fallback to any social app
            apps = self.app_registry.get_apps_for_category(AppCategory.SOCIAL, self.device_type)
            if apps:
                app_info = self.rng.choice(apps)

        if not app_info:
            raise ValueError(f"No app found for category {app_category}")

        return AppStoryData(
            time=activity_time,
            app=_AppInfo(
                app_id=app_info.app_id,
                name=app_info.display_name,
            ),
            app_id=app_info.app_id,
            user_description=activity.description,
        )

    def _generate_location_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
    ) -> LocationStoryData:
        """Generate a location story."""
        params = activity.parameters

        location_type = params.get("location_type", "home")
        category = params.get("category", "Unknown")

        # Get or create coordinates for this location type
        coordinate = self._get_location_coordinate(str(location_type))

        return LocationStoryData(
            time=activity_time,
            coordinate=coordinate,
            category=str(category),
            user_description=activity.description,
        )

    def _generate_web_history_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
    ) -> WebHistoryStoryData:
        """Generate a web history story."""
        params = activity.parameters

        category = params.get("category", "news")
        site_hint = params.get("site_hint", None)

        # Get URL templates for category
        templates = WEB_HISTORY_TEMPLATES.get(str(category), WEB_HISTORY_TEMPLATES["news"])

        # Try to match site hint
        selected = None
        if site_hint and isinstance(site_hint, str):
            hint_lower = site_hint.lower()
            for template in templates:
                if hint_lower in template["title"].lower() or hint_lower in template["url"].lower():
                    selected = template
                    break

        if not selected:
            selected = self.rng.choice(templates)

        return WebHistoryStoryData(
            time=activity_time,
            url=selected["url"],
            title=selected["title"],
            uses=1,
            user_description=activity.description,
        )

    def _generate_powering_event_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
    ) -> PoweringEventStoryData:
        """Generate a powering event story (charging)."""
        params = activity.parameters

        event_type = params.get("event_type", "charging_end")

        # Map event types to powering event names
        event_name_map = {
            "charging_start": "Connect",
            "charging_end": "Disconnect",
            "power_on": "On",
            "power_off": "Off",
        }

        event_name = event_name_map.get(str(event_type), "Disconnect")

        # Get battery level from parameters
        battery_level = params.get("typical_battery_level", 100)

        description = f"Battery at {battery_level}%"

        return PoweringEventStoryData(
            time=activity_time,
            event_name=event_name,
            description=description,
            user_description=activity.description,
        )

    def _generate_route_stories(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
        duration_minutes: int | None = None,
    ) -> list[LocationStoryData]:
        """Generate location stories for a route (start and end points)."""
        params = activity.parameters

        from_location = params.get("from", "home")
        to_location = params.get("to", "work")
        duration = duration_minutes or params.get("duration_minutes", 30)

        # Generate start location
        start_coord = self._get_location_coordinate(str(from_location))
        start_story = LocationStoryData(
            time=activity_time,
            coordinate=start_coord,
            category=ROUTINE_LOCATION_PRESETS.get(str(from_location), {}).get("category", "Unknown"),
            user_description=f"Route start: {from_location}",
        )

        # Generate end location (at end of duration)
        from datetime import timedelta

        end_time = activity_time + timedelta(minutes=int(duration))
        end_coord = self._get_location_coordinate(str(to_location))
        end_story = LocationStoryData(
            time=end_time,
            coordinate=end_coord,
            category=ROUTINE_LOCATION_PRESETS.get(str(to_location), {}).get("category", "Unknown"),
            user_description=f"Route end: {to_location}",
        )

        return [start_story, end_story]

    def _generate_call_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
        duration_minutes: int | None = None,
    ) -> CallStoryData:
        """Generate a call story for routine phone calls.

        Args:
            activity: The routine activity
            activity_time: When the call occurs
            duration_minutes: Optional duration in minutes

        Returns:
            CallStoryData representing the call
        """
        params = activity.parameters

        # Get contact category and direction
        contact_category = str(params.get("contact_category", "family"))
        direction = str(params.get("direction", "outgoing"))
        call_type = str(params.get("call_type", "cellular"))

        # Select a contact from the category
        contacts = ROUTINE_CONTACTS.get(contact_category, ROUTINE_CONTACTS["family"])
        contact = self.rng.choice(contacts)

        # Calculate duration in seconds
        duration_mins = duration_minutes or params.get("duration_minutes", 5)
        if isinstance(duration_mins, int):
            # Add some variation to call duration
            duration_seconds = duration_mins * 60 + self.rng.randint(-30, 60)
            duration_seconds = max(30, duration_seconds)  # Minimum 30 seconds
        else:
            duration_seconds = 300  # Default 5 minutes

        return CallStoryData(
            time=activity_time,
            participant=contact["phone"],
            direction=direction,
            call_type=call_type,
            duration=duration_seconds,
            user_description=activity.description,
        )

    def _generate_sms_story(
        self,
        activity: RoutineActivity,
        activity_time: datetime,
    ) -> InstantMessageStoryData:
        """Generate an SMS/instant message story.

        Args:
            activity: The routine activity
            activity_time: When the message is sent/received

        Returns:
            InstantMessageStoryData representing the SMS
        """
        params = activity.parameters

        # Get contact category and message category
        contact_category = str(params.get("contact_category", "family"))
        message_category = str(params.get("message_category", "casual"))
        status = str(params.get("status", "Read"))

        # Select a contact from the category
        contacts = ROUTINE_CONTACTS.get(contact_category, ROUTINE_CONTACTS["family"])
        contact = self.rng.choice(contacts)

        # Select a message template
        messages = SMS_MESSAGE_TEMPLATES.get(message_category, SMS_MESSAGE_TEMPLATES["casual"])
        text = self.rng.choice(messages)

        return InstantMessageStoryData(
            time=activity_time,
            sender=contact["phone"],
            text=text,
            status=status,
            user_description=activity.description,
        )

    def _get_base_coordinates_for_entity(self) -> tuple[float, float]:
        """Get base coordinates based on entity location.

        Looks up the entity's location field and returns appropriate base coordinates.
        Falls back to NYC if no location is specified or not found.

        Returns:
            Tuple of (latitude, longitude) for the entity's base location.
        """
        # Default to NYC if no location specified
        default_coords = (40.7128, -74.0060)

        location = getattr(self.entity.characteristics, "location", None)
        if not location:
            # Try to extract location from background
            background = self.entity.characteristics.background
            if background:
                location = self._extract_location_from_text(background)

        if not location:
            return default_coords

        # Normalize the location string
        location_lower = location.lower().strip()

        # Direct lookup in city coordinates
        if location_lower in CITY_COORDINATES:
            return CITY_COORDINATES[location_lower]

        # Try partial matches
        for city_name, coords in CITY_COORDINATES.items():
            if city_name in location_lower or location_lower in city_name:
                return coords

        # No match found, use default
        logger.debug(f"Location '{location}' not found in city database, using default NYC coordinates")
        return default_coords

    def _extract_location_from_text(self, text: str) -> str | None:
        """Try to extract a city name from text (e.g., background description).

        Args:
            text: Text that may contain a city name

        Returns:
            City name if found, None otherwise
        """
        import re

        text_lower = text.lower()

        # Sort city names by length (longest first) to avoid partial matches
        # e.g., "la" matching "last" before we check "london"
        sorted_cities = sorted(CITY_COORDINATES.keys(), key=len, reverse=True)

        # Check for city names in the text with word boundaries
        for city_name in sorted_cities:
            # Use word boundary matching to avoid partial matches
            # e.g., "la" should not match "last" or "plan"
            pattern = r"\b" + re.escape(city_name) + r"\b"
            if re.search(pattern, text_lower):
                return city_name

        return None

    def _get_location_coordinate(self, location_type: str) -> Coordinate:
        """Get or generate a coordinate for a location type.

        Uses entity's location to generate realistic coordinates in their city.
        Caches coordinates so the same location type returns consistent coordinates.
        """
        if location_type in self._location_cache:
            return self._location_cache[location_type]

        preset = ROUTINE_LOCATION_PRESETS.get(location_type)

        # Use entity's base coordinates as the center for all locations
        base_lat, base_lon = self._base_lat, self._base_lon

        if preset:
            # Calculate offset from the preset's NYC-based coordinates
            # This preserves relative distances between locations
            nyc_lat, nyc_lon = 40.7128, -74.0060
            lat_offset = preset["lat_base"] - nyc_lat
            lon_offset = preset["lon_base"] - nyc_lon

            # Apply the offset to entity's base location, with variance
            lat = base_lat + lat_offset + self.rng.uniform(-preset["variance"], preset["variance"])
            lon = base_lon + lon_offset + self.rng.uniform(-preset["variance"], preset["variance"])
        else:
            # Generate random coordinates near the entity's base location
            lat = base_lat + self.rng.uniform(-0.1, 0.1)
            lon = base_lon + self.rng.uniform(-0.1, 0.1)

        coordinate = Coordinate(latitude=lat, longitude=lon)
        self._location_cache[location_type] = coordinate

        return coordinate

    def get_app_for_category(self, category: ActivityCategory) -> str | None:
        """Get an appropriate app ID for a given activity category."""
        category_to_app_category = {
            ActivityCategory.SOCIAL_MEDIA: AppCategory.SOCIAL,
            ActivityCategory.COMMUNICATION: AppCategory.MESSAGING,
            ActivityCategory.WORK: AppCategory.EMAIL,
            ActivityCategory.ENTERTAINMENT: AppCategory.BROWSER,
            ActivityCategory.LOCATION: AppCategory.MAPS,
            ActivityCategory.SYSTEM: AppCategory.SYSTEM,
            ActivityCategory.PERSONAL_CARE: AppCategory.SYSTEM,
        }

        app_category = category_to_app_category.get(category, AppCategory.SOCIAL)
        app_info = self.app_registry.get_default_app(app_category, self.device_type)

        return app_info.app_id if app_info else None
