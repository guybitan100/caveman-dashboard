import itertools
from typing import NamedTuple, Iterable

from core.titan_logger import logger
from generation.simulation.social import SocialContext
from model.types import InstalledApplication, GeneratedData


class JumpTarget(NamedTuple):
    jump_target_id: str
    jump_target_type: type[GeneratedData]


class SerializerContext:
    def __init__(self, social_context: SocialContext, apps: Iterable[InstalledApplication]):
        self.social_context = social_context
        self.app_uid_to_name = {app.uid: app.name for app in apps}
        self.jump_targets: dict[str, set[tuple[str, type[GeneratedData]]]] = {}
        self._source_index = itertools.count(start=1)

    @property
    def source_index(self) -> int:
        return next(self._source_index)

    def register_jump_targets(
            self,
            parent_event: GeneratedData,
            child_event: GeneratedData | str,
            child_type: type[GeneratedData] | None = None
    ) -> None:
        """
        Method to register jump targets in the report.xml

        :param parent_event: The parent event. Must be the GeneratedData event.
        :param child_event: The child event. Can be GeneratedData event or just the event uid.
        :param child_type: Optional child type. Must be passed when child_event is only the event uid, ignored when
        the child event is GeneratedData
        :return:
        """
        if isinstance(child_event, GeneratedData):
            child_id = child_event.uid
            if child_type:
                logger.warn(
                    f'Child type was passed with a GeneratedData child event. Ignoring child_type...',
                    child_id=child_id, child_type=child_type
                )
            child_type = type(child_event)
        else:
            child_id = child_event
            child_type = child_type

        self._register_jump_target(event_id=parent_event.uid, jt_id=child_id, jt_type=child_type)
        if child_type != InstalledApplication:
            self._register_jump_target(event_id=child_id, jt_id=parent_event.uid, jt_type=type(parent_event))

    def _register_jump_target(self, event_id: str, jt_id: str, jt_type: type[GeneratedData]) -> None:
        jump_target = JumpTarget(jump_target_id=jt_id, jump_target_type=jt_type)
        jump_targets_set = self.jump_targets.get(event_id, set())
        jump_targets_set.add(jump_target)
        self.jump_targets[event_id] = jump_targets_set
