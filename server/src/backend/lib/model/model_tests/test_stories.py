import pytest
from datetime import date

from model.stories import (
    _handle_null_type_json_schema,
    story_data_schema_extra,
    get_story_data_class,
    StoryType,
    CallStoryData,
    ChatStoryData,
    ChatMessageStoryData,
    InstantMessageStoryData,
    EmailStoryData,
    ContactStoryData,
    LocationStoryData,
    RouteStoryData,
    ImageStoryData,
    _ChatStoryData,
    _ContactInfo,
)


class TestHandleNullTypeJsonSchema:
    def test_no_anyof(self):
        schema = {"type": "string"}
        result = _handle_null_type_json_schema(schema)
        assert result == {"type": "string"}

    def test_anyof_nullable(self):
        schema = {"anyOf": [{"type": "string"}, {"type": "null"}]}
        result = _handle_null_type_json_schema(schema)
        assert result.get("nullable") is True
        assert "anyOf" not in result

    def test_nested_object(self):
        schema = {
            "type": "object",
            "properties": {
                "field": {"anyOf": [{"type": "integer"}, {"type": "null"}]}
            },
        }
        result = _handle_null_type_json_schema(schema)
        assert result["properties"]["field"].get("nullable") is True


class TestGetStoryDataClass:
    def test_known_type(self):
        cls = get_story_data_class(StoryType.CALL)
        assert cls is CallStoryData

    def test_unknown_type_raises(self):
        with pytest.raises(Exception, match="does not have"):
            get_story_data_class("nonexistent_type")


class TestCallStoryData:
    def test_create(self):
        story = CallStoryData(
            participant="e1",
            direction="Incoming",
            time="2024-01-01T00:00:00",
        )
        assert story.story_type == StoryType.CALL


class TestInstantMessageStoryData:
    def test_create(self):
        story = InstantMessageStoryData(
            sender="e1",
            text="hello",
            time="2024-01-01T00:00:00",
        )
        assert story.story_type == StoryType.INSTANT_MESSAGE


class TestEmailStoryData:
    def test_create(self):
        story = EmailStoryData(
            from_="e1",
            to=["e2"],
            subject="test",
            time="2024-01-01T00:00:00",
        )
        assert story.story_type == StoryType.EMAIL

    def test_no_recipients_fails(self):
        with pytest.raises(Exception):
            EmailStoryData(from_="e1", to=[], subject="test", time="2024-01-01T00:00:00")


class TestChatStoryData:
    def test_create(self):
        msg = ChatMessageStoryData(
            sender="e1",
            text="hi",
            chat_uid="c1",
            time="2024-01-01T00:00:00",
        )
        chat = _ChatStoryData(
            participants=["e1", "e2"],
            messages=[msg],
        )
        story = ChatStoryData(chat=chat)
        assert story.story_type == StoryType.CHAT
        inner = story.get_inner_stories()
        assert len(inner) == 1


class TestContactInfo:
    def test_valid(self):
        c = _ContactInfo(phones=["123"], emails=[])
        assert c.phones == ["123"]

    def test_no_contact_raises(self):
        with pytest.raises(Exception):
            _ContactInfo(phones=[], emails=[])


class TestContactStoryData:
    def test_create(self):
        story = ContactStoryData(
            contact=_ContactInfo(phones=["123"], emails=[]),
            time="2024-01-01T00:00:00",
        )
        assert story.story_type == StoryType.CONTACT


class TestLocationStoryData:
    def test_create(self):
        story = LocationStoryData(
            coordinate={"latitude": 40.0, "longitude": -74.0},
            time="2024-01-01T00:00:00",
        )
        assert story.story_type == StoryType.LOCATION


class TestSchemaExtra:
    def test_story_data_schema_extra_for_call(self):
        schema = CallStoryData.model_json_schema()
        assert "title" in schema
