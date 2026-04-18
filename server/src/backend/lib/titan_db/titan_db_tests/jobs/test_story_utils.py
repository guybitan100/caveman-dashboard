from unittest.mock import patch, MagicMock
from datetime import datetime

import pytest
from networkx import DiGraph

from titan_db.jobs.db_story_utils import (
    insert_story,
    insert_stories,
    delete_story,
    _add_story,
    _add_story_node,
    _update_story_node,
    _get_story_node,
    _add_ref_edge,
    _remove_edge,
)
from titan_db.jobs.errors import StoryNotFoundError
from model.stories import CallStoryData, AppStoryData, _AppInfo


def _make_call_story(story_id="s1", participant="e1", direction="Incoming"):
    return CallStoryData.model_validate(
        {
            "story_id": story_id,
            "time": datetime(2024, 1, 1).isoformat(),
            "participant": participant,
            "direction": direction,
            "story_type": "call",
        },
        context={"source": "db"},
    )


def _make_app_story(story_id="app1", app_id="com.example.app"):
    return AppStoryData.model_validate(
        {
            "story_id": story_id,
            "time": datetime(2024, 1, 1).isoformat(),
            "app_id": app_id,
            "app": {"app_id": app_id, "name": "ExampleApp"},
            "story_type": "app",
        },
        context={"source": "db"},
    )


class TestGraphHelpers:
    def test_add_story_node(self):
        g = DiGraph()
        story = _make_call_story(story_id="s1")
        _add_story_node(graph=g, story=story)
        assert "s1" in g.nodes
        assert "data" in g.nodes["s1"]

    def test_update_story_node(self):
        g = DiGraph()
        story = _make_call_story(story_id="s1", direction="Incoming")
        _add_story_node(graph=g, story=story)
        story2 = _make_call_story(story_id="s1", direction="Outgoing")
        _update_story_node(graph=g, story=story2)
        assert g.nodes["s1"]["data"]["direction"] == "Outgoing"

    def test_get_story_node(self):
        g = DiGraph()
        story = _make_call_story(story_id="s1")
        _add_story_node(graph=g, story=story)
        retrieved = _get_story_node(graph=g, story_id="s1")
        assert retrieved.direction == "Incoming"

    def test_get_story_node_not_found(self):
        g = DiGraph()
        with pytest.raises(StoryNotFoundError):
            _get_story_node(graph=g, story_id="nonexistent")


class TestAddRefEdge:
    def test_add_single_edge(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        _add_ref_edge(graph=g, u_story_id="s1", v_story_id="s2", ref_field="chat_uid")
        assert g.has_edge("s1", "s2")

    def test_add_list_edges(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        g.add_node("s3", data={})
        _add_ref_edge(
            graph=g, u_story_id="s1", v_story_id=["s2", "s3"], ref_field="refs"
        )
        assert g.has_edge("s1", "s2")
        assert g.has_edge("s1", "s3")

    def test_source_not_found(self):
        g = DiGraph()
        g.add_node("s2", data={})
        with pytest.raises(StoryNotFoundError):
            _add_ref_edge(graph=g, u_story_id="missing", v_story_id="s2", ref_field="x")

    def test_target_not_found(self):
        g = DiGraph()
        g.add_node("s1", data={})
        with pytest.raises(StoryNotFoundError):
            _add_ref_edge(graph=g, u_story_id="s1", v_story_id="missing", ref_field="x")

    def test_list_target_not_found(self):
        g = DiGraph()
        g.add_node("s1", data={})
        with pytest.raises(StoryNotFoundError):
            _add_ref_edge(
                graph=g, u_story_id="s1", v_story_id=["missing"], ref_field="x"
            )


class TestRemoveEdge:
    def test_remove_single_edge(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        g.add_edge("s1", "s2")
        _remove_edge(graph=g, u_story_id="s1", v_story_id="s2")
        assert not g.has_edge("s1", "s2")

    def test_remove_list_edges(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        g.add_node("s3", data={})
        g.add_edge("s1", "s2")
        g.add_edge("s1", "s3")
        _remove_edge(graph=g, u_story_id="s1", v_story_id=["s2", "s3"])
        assert not g.has_edge("s1", "s2")
        assert not g.has_edge("s1", "s3")

    def test_edge_not_found(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        with pytest.raises(StoryNotFoundError):
            _remove_edge(graph=g, u_story_id="s1", v_story_id="s2")

    def test_source_not_found(self):
        g = DiGraph()
        with pytest.raises(StoryNotFoundError):
            _remove_edge(graph=g, u_story_id="missing", v_story_id="s2")

    def test_list_target_not_found(self):
        g = DiGraph()
        g.add_node("s1", data={})
        with pytest.raises(StoryNotFoundError):
            _remove_edge(graph=g, u_story_id="s1", v_story_id=["missing"])

    def test_list_edge_not_found(self):
        g = DiGraph()
        g.add_node("s1", data={})
        g.add_node("s2", data={})
        with pytest.raises(StoryNotFoundError):
            _remove_edge(graph=g, u_story_id="s1", v_story_id=["s2"])


class TestAddStory:
    def test_add_simple_story(self):
        g = DiGraph()
        story = _make_call_story(story_id="s1")
        _add_story(stories_graph=g, story=story)
        assert "s1" in g.nodes

    def test_add_call_story_with_app(self):
        g = DiGraph()
        story = _make_call_story(story_id="s1")
        story.app_id = "com.example.phone"
        _add_story(stories_graph=g, story=story)
        assert "s1" in g.nodes


@patch("titan_db.jobs.db_story_utils.db_job_utils")
class TestInsertStory:
    def test_insert_single(self, mock_utils):
        mock_job = MagicMock()
        mock_job.stories = DiGraph()
        mock_utils.get_job_model.return_value = mock_job
        story = _make_call_story(story_id="s1")
        insert_story(job_id="j1", story=story)
        mock_utils.update_job_model.assert_called_once()

    def test_insert_multiple(self, mock_utils):
        mock_job = MagicMock()
        mock_job.stories = DiGraph()
        mock_utils.get_job_model.return_value = mock_job
        stories = [_make_call_story(story_id="s1"), _make_call_story(story_id="s2")]
        insert_stories(job_id="j1", stories=stories)
        mock_utils.update_job_model.assert_called_once()


@patch("titan_db.jobs.db_story_utils.db_job_utils")
class TestDeleteStory:
    def test_delete_existing_story(self, mock_utils):
        g = DiGraph()
        story = _make_call_story(story_id="s1")
        _add_story_node(graph=g, story=story)
        mock_job = MagicMock()
        mock_job.stories = g
        mock_utils.get_job_model.return_value = mock_job
        delete_story(job_id="j1", story_id="s1")
        assert "s1" not in g.nodes
        mock_utils.update_job_model.assert_called_once()

    def test_delete_nonexistent_story(self, mock_utils):
        mock_job = MagicMock()
        mock_job.stories = DiGraph()
        mock_utils.get_job_model.return_value = mock_job
        with pytest.raises(StoryNotFoundError):
            delete_story(job_id="j1", story_id="nonexistent")
