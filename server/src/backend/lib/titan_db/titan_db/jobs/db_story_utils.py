from networkx import DiGraph

from model.stories import StoryData, EventStoryData, AppStoryData, _AppInfo, StoryDataAdapter
from model.utils import deserialize
from titan_db.jobs import db_job_utils
from titan_db.jobs.errors import StoryNotFoundError
from titan_db.jobs.models import DBJobModel

def insert_story(job_id: str, story: StoryData) -> None:
    db_job = db_job_utils.get_job_model(job_id=job_id, attributes=[DBJobModel.stories.attr_name])
    stories_graph: DiGraph = db_job.stories
    _add_story(stories_graph=stories_graph, story=story)
    db_job_utils.update_job_model(job_id=job_id, actions=[DBJobModel.stories.set(stories_graph)])

def insert_stories(job_id: str, stories: list[StoryData]) -> None:
    db_job = db_job_utils.get_job_model(job_id=job_id, attributes=[DBJobModel.stories.attr_name])
    stories_graph: DiGraph = db_job.stories
    for story in stories:
        _add_story(stories_graph=stories_graph, story=story)
    db_job_utils.update_job_model(job_id=job_id, actions=[DBJobModel.stories.set(stories_graph)])

def _add_story(stories_graph: DiGraph, story: StoryData) -> None:
    _add_story_node(graph=stories_graph, story=story)  # Attaches new story_id to story object
    for field_name, field_value in story.get_story_ref_fields().items():
        if field_value is None:
            continue
        if isinstance(story, EventStoryData) and field_name == 'app_id' and field_value not in stories_graph:
            # App does not exist yet; create an app story
            app_story = AppStoryData(
                time=story.time,
                app_id=field_value,
                app=_AppInfo(app_id=field_value, name=field_value)
            )
            _add_story_node(graph=stories_graph, story=app_story)
            field_value = app_story.story_id
        _add_ref_edge(graph=stories_graph, u_story_id=story.story_id, v_story_id=field_value, ref_field=field_name)

def update_story(job_id: str, story_id: str, story: StoryData) -> None:
    db_job = db_job_utils.get_job_model(job_id=job_id, attributes=[DBJobModel.stories.attr_name])
    stories: DiGraph = db_job.stories
    if story_id not in stories:
        raise StoryNotFoundError(story_id=story_id)

    story.story_id = story_id
    curr_story = _get_story_node(graph=stories, story_id=story_id)

    # Update edges for story references & remove old edges that are no longer referenced
    curr_refs = curr_story.get_story_ref_fields()
    new_refs = story.get_story_ref_fields()
    for field_name, curr_field_value in curr_refs.items():
        new_field_value = new_refs[field_name]
        if new_field_value == curr_field_value:
            continue    # No change in this field; skip

        # Account for curr_field_value or new_field_value being None
        if curr_field_value is None:
            _add_ref_edge(graph=stories, u_story_id=story_id, v_story_id=new_field_value, ref_field=field_name)
        elif new_field_value is None:
            _remove_edge(graph=stories, u_story_id=story_id, v_story_id=curr_field_value)
        else:   # Either curr_field_value and new_field_value are both strings or both lists
            if isinstance(new_field_value, str):
                _remove_edge(graph=stories, u_story_id=story_id, v_story_id=curr_field_value)
                _add_ref_edge(graph=stories, u_story_id=story_id, v_story_id=new_field_value, ref_field=field_name)
            elif isinstance(new_field_value, list):
                curr_ref_ids = set(curr_field_value)
                new_ref_ids = set(new_field_value)
                # Remove edges that are no longer referenced
                for ref_id in curr_ref_ids - new_ref_ids:
                    _remove_edge(graph=stories, u_story_id=story_id, v_story_id=ref_id)
                # Add new edges
                for ref_id in new_ref_ids - curr_ref_ids:
                    _add_ref_edge(graph=stories, u_story_id=story_id, v_story_id=ref_id, ref_field=field_name)

    # Update the story node data
    _update_story_node(graph=stories, story=story)
    db_job_utils.update_job_model(job_id=job_id, actions=[DBJobModel.stories.set(stories)])

def delete_story(job_id: str, story_id: str) -> None:
    db_job = db_job_utils.get_job_model(job_id=job_id, attributes=[DBJobModel.stories.attr_name])
    stories: DiGraph = db_job.stories
    if story_id not in stories:
        raise StoryNotFoundError(story_id=story_id)

    ref_story_ids = stories.predecessors(story_id)  # Get IDs of stories referencing this story
    for ref_story_id in ref_story_ids:
        ref_story = _get_story_node(graph=stories, story_id=ref_story_id)
        ref_edge = stories.edges[(ref_story_id, story_id)]
        ref_field_name = ref_edge['ref_field']
        ref_field_value = getattr(ref_story, ref_field_name)
        if isinstance(ref_field_value, str):
            setattr(ref_story, ref_field_value, None)   # TODO will it always be None?
        elif isinstance(ref_field_value, list):
            ref_field_value.remove(story_id)
            setattr(ref_story, ref_field_name, ref_field_value)
        # Update the referencing story node data
        _update_story_node(graph=stories, story=ref_story)

    stories.remove_node(story_id)
    db_job_utils.update_job_model(job_id=job_id, actions=[DBJobModel.stories.set(stories)])

def _add_story_node(graph: DiGraph, story: StoryData) -> None:
    graph.add_node(story.story_id, data=story.model_dump(mode='json'))

def _update_story_node(graph: DiGraph, story: StoryData) -> None:
    graph.nodes[story.story_id]['data'] = story.model_dump(mode='json')

def _get_story_node(graph: DiGraph, story_id: str) -> StoryData:
    if story_id not in graph.nodes:
        raise StoryNotFoundError(story_id=story_id)
    story_data = graph.nodes[story_id]['data']
    story = deserialize(story_data, StoryDataAdapter)
    return story

def _add_ref_edge(
        graph: DiGraph,
        u_story_id: str,
        v_story_id: str | list[str],
        *,
        ref_field: str
) -> None:
    if u_story_id not in graph.nodes:
        raise StoryNotFoundError(story_id=u_story_id)
    if isinstance(v_story_id, list):
        for v in v_story_id:
            if v not in graph.nodes:
                raise StoryNotFoundError(story_id=v)
            graph.add_edge(u_story_id, v, ref_field=ref_field)
    else:
        if v_story_id not in graph.nodes:
            raise StoryNotFoundError(story_id=v_story_id)
        graph.add_edge(u_story_id, v_story_id, ref_field=ref_field)

def _remove_edge(graph: DiGraph, u_story_id: str, v_story_id: str | list[str]) -> None:
    if u_story_id not in graph.nodes:
        raise StoryNotFoundError(story_id=u_story_id)
    if isinstance(v_story_id, list):
        for v in v_story_id:
            if v not in graph.nodes:
                raise StoryNotFoundError(story_id=v)
            if not graph.has_edge(u_story_id, v):
                raise StoryNotFoundError(story_id=f'Edge from {u_story_id} to {v} not found')
            graph.remove_edge(u_story_id, v)
    else:
        if v_story_id not in graph.nodes:
            raise StoryNotFoundError(story_id=v_story_id)
        if not graph.has_edge(u_story_id, v_story_id):
            raise StoryNotFoundError(story_id=f'Edge from {u_story_id} to {v_story_id} not found')
        graph.remove_edge(u_story_id, v_story_id)
