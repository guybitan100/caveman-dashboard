"""App ID registry for realistic app identifiers per device type and story type."""

from dataclasses import dataclass, field
from enum import StrEnum

from .phone_selection import DeviceType


class AppCategory(StrEnum):
    """Categories of apps for story generation."""
    MESSAGING = "messaging"
    SOCIAL = "social"
    EMAIL = "email"
    CALL = "call"
    GALLERY = "gallery"
    BROWSER = "browser"
    MAPS = "maps"
    CALENDAR = "calendar"
    NOTES = "notes"
    SYSTEM = "system"


@dataclass
class AppInfo:
    """Information about an app."""
    app_id: str
    display_name: str
    category: AppCategory
    device_types: list[DeviceType] = field(default_factory=lambda: [DeviceType.GENERIC])
    is_default: bool = False  # Prefer this app when multiple options exist


# Messaging Apps - Chat/SMS/MMS
MESSAGING_APPS: list[AppInfo] = [
    # Android messaging
    AppInfo(
        app_id="com.google.android.apps.messaging",
        display_name="Google Messages",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.samsung.android.messaging",
        display_name="Samsung Messages",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID],
    ),
    # iOS messaging
    AppInfo(
        app_id="com.apple.MobileSMS",
        display_name="Messages",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
    # Cross-platform messaging apps
    AppInfo(
        app_id="com.whatsapp",
        display_name="WhatsApp",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="org.telegram.messenger",
        display_name="Telegram",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="org.thoughtcrime.securesms",
        display_name="Signal",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.facebook.orca",
        display_name="Messenger",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.viber.voip",
        display_name="Viber",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="jp.naver.line.android",
        display_name="LINE",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.tencent.mm",
        display_name="WeChat",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.snapchat.android",
        display_name="Snapchat",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.discord",
        display_name="Discord",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.Slack",
        display_name="Slack",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.microsoft.teams",
        display_name="Microsoft Teams",
        category=AppCategory.MESSAGING,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
]

# Social Media Apps
SOCIAL_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.instagram.android",
        display_name="Instagram",
        category=AppCategory.SOCIAL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.facebook.katana",
        display_name="Facebook",
        category=AppCategory.SOCIAL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.twitter.android",
        display_name="X (Twitter)",
        category=AppCategory.SOCIAL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.zhiliaoapp.musically",
        display_name="TikTok",
        category=AppCategory.SOCIAL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.linkedin.android",
        display_name="LinkedIn",
        category=AppCategory.SOCIAL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
]

# Email Apps
EMAIL_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.google.android.gm",
        display_name="Gmail",
        category=AppCategory.EMAIL,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.apple.mobilemail",
        display_name="Mail",
        category=AppCategory.EMAIL,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
    AppInfo(
        app_id="com.microsoft.office.outlook",
        display_name="Outlook",
        category=AppCategory.EMAIL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
    AppInfo(
        app_id="com.yahoo.mobile.client.android.mail",
        display_name="Yahoo Mail",
        category=AppCategory.EMAIL,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
]

# Call/Phone Apps
CALL_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.google.android.dialer",
        display_name="Phone",
        category=AppCategory.CALL,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.samsung.android.dialer",
        display_name="Phone",
        category=AppCategory.CALL,
        device_types=[DeviceType.ANDROID],
    ),
    AppInfo(
        app_id="com.apple.mobilephone",
        display_name="Phone",
        category=AppCategory.CALL,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
]

# Gallery/Photos Apps
GALLERY_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.google.android.apps.photos",
        display_name="Google Photos",
        category=AppCategory.GALLERY,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.samsung.android.gallery",
        display_name="Gallery",
        category=AppCategory.GALLERY,
        device_types=[DeviceType.ANDROID],
    ),
    AppInfo(
        app_id="com.htc.album",
        display_name="Gallery",
        category=AppCategory.GALLERY,
        device_types=[DeviceType.ANDROID],
    ),
    AppInfo(
        app_id="com.apple.mobileslideshow",
        display_name="Photos",
        category=AppCategory.GALLERY,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
]

# Browser Apps
BROWSER_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.android.chrome",
        display_name="Chrome",
        category=AppCategory.BROWSER,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.apple.mobilesafari",
        display_name="Safari",
        category=AppCategory.BROWSER,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
    AppInfo(
        app_id="org.mozilla.firefox",
        display_name="Firefox",
        category=AppCategory.BROWSER,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
]

# Maps/Location Apps
MAPS_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.google.android.apps.maps",
        display_name="Google Maps",
        category=AppCategory.MAPS,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
        is_default=True,
    ),
    AppInfo(
        app_id="com.apple.Maps",
        display_name="Maps",
        category=AppCategory.MAPS,
        device_types=[DeviceType.IPHONE],
    ),
    AppInfo(
        app_id="com.waze",
        display_name="Waze",
        category=AppCategory.MAPS,
        device_types=[DeviceType.ANDROID, DeviceType.IPHONE, DeviceType.GENERIC],
    ),
]

# System Apps
SYSTEM_APPS: list[AppInfo] = [
    AppInfo(
        app_id="com.android.providers.contacts",
        display_name="Contacts",
        category=AppCategory.SYSTEM,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.apple.MobileAddressBook",
        display_name="Contacts",
        category=AppCategory.SYSTEM,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
    AppInfo(
        app_id="com.android.calendar",
        display_name="Calendar",
        category=AppCategory.CALENDAR,
        device_types=[DeviceType.ANDROID],
        is_default=True,
    ),
    AppInfo(
        app_id="com.apple.mobilecal",
        display_name="Calendar",
        category=AppCategory.CALENDAR,
        device_types=[DeviceType.IPHONE],
        is_default=True,
    ),
]

# Combined registry
ALL_APPS: list[AppInfo] = (
    MESSAGING_APPS + SOCIAL_APPS + EMAIL_APPS + CALL_APPS + 
    GALLERY_APPS + BROWSER_APPS + MAPS_APPS + SYSTEM_APPS
)


class AppRegistry:
    """Registry for looking up app IDs by category and device type."""
    
    def __init__(self) -> None:
        self._apps_by_category: dict[AppCategory, list[AppInfo]] = {}
        self._apps_by_id: dict[str, AppInfo] = {}
        
        for app in ALL_APPS:
            # Index by category
            if app.category not in self._apps_by_category:
                self._apps_by_category[app.category] = []
            self._apps_by_category[app.category].append(app)
            
            # Index by ID
            self._apps_by_id[app.app_id] = app
    
    def get_app_by_id(self, app_id: str) -> AppInfo | None:
        """Look up an app by its ID."""
        return self._apps_by_id.get(app_id)
    
    def get_apps_for_category(
        self,
        category: AppCategory,
        device_type: DeviceType = DeviceType.GENERIC,
    ) -> list[AppInfo]:
        """Get all apps matching a category and device type."""
        apps = self._apps_by_category.get(category, [])
        return [
            app for app in apps
            if device_type in app.device_types or DeviceType.GENERIC in app.device_types
        ]
    
    def get_default_app(
        self,
        category: AppCategory,
        device_type: DeviceType = DeviceType.GENERIC,
    ) -> AppInfo | None:
        """Get the default app for a category on a specific device type."""
        apps = self.get_apps_for_category(category, device_type)
        
        # First try to find a platform-specific default
        for app in apps:
            if app.is_default and device_type in app.device_types:
                return app
        
        # Fall back to any default
        for app in apps:
            if app.is_default:
                return app
        
        # Fall back to first available
        return apps[0] if apps else None
    
    def get_messaging_app(
        self,
        device_type: DeviceType = DeviceType.GENERIC,
        prefer_third_party: bool = False,
        app_name_hint: str | None = None,
    ) -> AppInfo | None:
        """
        Get a messaging app with optional preferences.
        
        Args:
            device_type: Target device platform
            prefer_third_party: If True, prefer apps like WhatsApp over native SMS
            app_name_hint: Optional hint to select a specific app (e.g., "whatsapp", "telegram")
        """
        apps = self.get_apps_for_category(AppCategory.MESSAGING, device_type)
        
        if app_name_hint:
            hint_lower = app_name_hint.lower()
            for app in apps:
                if hint_lower in app.display_name.lower() or hint_lower in app.app_id.lower():
                    return app
        
        if prefer_third_party:
            # Prefer cross-platform apps
            for app in apps:
                if DeviceType.GENERIC in app.device_types:
                    return app
        
        return self.get_default_app(AppCategory.MESSAGING, device_type)
    
    def get_random_messaging_app(
        self,
        device_type: DeviceType = DeviceType.GENERIC,
        exclude_native: bool = False,
    ) -> AppInfo | None:
        """Get a random messaging app for variety in stories."""
        import random
        
        apps = self.get_apps_for_category(AppCategory.MESSAGING, device_type)
        
        if exclude_native:
            apps = [
                app for app in apps 
                if DeviceType.GENERIC in app.device_types
            ]
        
        return random.choice(apps) if apps else None


# Singleton instance
_registry: AppRegistry | None = None


def get_app_registry() -> AppRegistry:
    """Get the singleton app registry instance."""
    global _registry
    if _registry is None:
        _registry = AppRegistry()
    return _registry
