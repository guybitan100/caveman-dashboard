import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List


REPO_ROOT = Path(__file__).parents[3]


class NoSuchLibraryError(Exception):
    pass


class ProjectType(str, Enum):
    LIBRARY = "lib"
    SERVICE = "services"
    MAIN = "main"
    CLIENT = "clients"


@dataclass
class Project:
    name: str
    type: ProjectType
    repo: str = "artifact"

    def path(self) -> Path:
        if self.name == "main":
            return REPO_ROOT

        if self.type is ProjectType.LIBRARY:
            project_root = Path(REPO_ROOT, "server", "src", "backend", "lib", self.name)
        elif self.type is ProjectType.SERVICE:
            project_root = Path(
                REPO_ROOT, "server", "src", "backend", "services", self.name
            )
        elif self.type is ProjectType.CLIENT:
            project_root = Path(REPO_ROOT, "server", "src", self.type.value, self.name)
        else:
            raise Exception(f"Could not find project root for type: {self.type.value}")

        assert "pyproject.toml" in os.listdir(project_root)
        return project_root


libraries = [
    Project("core", ProjectType.LIBRARY),
    Project("metafinder_core", ProjectType.LIBRARY),
    Project("model", ProjectType.LIBRARY),
    Project("simulation_utils", ProjectType.LIBRARY),
    Project("titan_db", ProjectType.LIBRARY),
]

clients = [
    Project("titan_client", ProjectType.CLIENT),
    Project("metafinder_client", ProjectType.CLIENT),
]

_libraries_mapping = {lib.name: lib for lib in libraries}

services = [
    Project("api", ProjectType.SERVICE),
    Project("ai-generator", ProjectType.SERVICE),
    Project("generation", ProjectType.SERVICE),
    Project("llm-gateway", ProjectType.SERVICE),
    Project("metafinder", ProjectType.SERVICE),
]

projects = [*libraries, *services, *clients]


def get_library(lib_name: str) -> Project:
    try:
        return _libraries_mapping[lib_name]
    except KeyError as e:
        raise NoSuchLibraryError from e


main_project = Project("main", ProjectType.MAIN)


def get_project_deps(project_type: ProjectType) -> List[ProjectType]:
    deps_hierarchy = {
        ProjectType.LIBRARY: [],
        ProjectType.CLIENT: [ProjectType.LIBRARY],
        ProjectType.SERVICE: [ProjectType.LIBRARY, ProjectType.CLIENT],
        ProjectType.MAIN: [
            ProjectType.LIBRARY,
            ProjectType.CLIENT,
            ProjectType.SERVICE,
        ],
    }
    return deps_hierarchy[project_type]
