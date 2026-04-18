from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from ai_generator.models import DeviceType, AppCategory, get_app_registry
from ai_generator.settings import SETTINGS


def get_model(model_name: str = "claude-sonnet-4-5") -> OpenAIChatModel:
    """
    Get a PydanticAI OpenAI model configured for LiteLLM proxy.

    Args:
        model_name: Name of the model to use (e.g., 'claude-sonnet-4-5')

    Returns:
        Configured OpenAIChatModel instance
    """
    return OpenAIChatModel(
        model_name=model_name,
        provider=OpenAIProvider(
            base_url=SETTINGS.LITELLM_BASE_URL,
            api_key=SETTINGS.LITELLM_API_KEY.get_secret_value(),
        ),
    )


def get_app_id_for_story_type(
    story_type: str,
    device_type: str | DeviceType,
    context_notes: dict[str, str] | None = None,
) -> str | None:
    """
    Get appropriate app_id based on story type and device.
    
    Args:
        story_type: Story type string (e.g., "call", "sms/mms", "chat")
        device_type: Device type string or enum
        context_notes: Optional context with app hints
    
    Returns:
        App ID string or None if no appropriate app found
    """
    context_notes = context_notes or {}
    
    # Map device type string to enum
    if isinstance(device_type, str):
        try:
            device = DeviceType(device_type)
        except ValueError:
            device = DeviceType.GENERIC
    else:
        device = device_type
    
    # Map story type to app category
    category_map = {
        "call": AppCategory.CALL,
        "sms/mms": AppCategory.MESSAGING,
        "chat": AppCategory.MESSAGING,
        "chat message": AppCategory.MESSAGING,
        "email": AppCategory.EMAIL,
        "location": AppCategory.MAPS,
        "image": AppCategory.GALLERY,
        "video": AppCategory.GALLERY,
        "audio": AppCategory.GALLERY,
        "web history": AppCategory.BROWSER,
        "web bookmarks": AppCategory.BROWSER,
        "contact": AppCategory.SYSTEM,
    }
    
    category = category_map.get(story_type.lower())
    if not category:
        return None
    
    # Check for app hint in context notes
    app_hint = context_notes.get("app_name") or context_notes.get("app")
    
    app_registry = get_app_registry()
    
    if category == AppCategory.MESSAGING and app_hint:
        app = app_registry.get_messaging_app(
            device_type=device, app_name_hint=app_hint
        )
    else:
        app = app_registry.get_default_app(category, device)
    
    return app.app_id if app else None

