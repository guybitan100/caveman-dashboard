import os
import subprocess
import sys
from enum import Enum
from loguru import logger
from titan_cli.projects import Project, clients, libraries, get_project_deps
from typing import List


class VersionPart(str, Enum):
    PATCH = "patch"
    MINOR = "minor"
    MAJOR = "major"
    PRE_PATCH = "prepatch"


class MkDocsCommand(Enum):
    BUILD = "build"
    SERVE = "serve"


class TitanCliError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


class Poetry:
    @staticmethod
    def run_command(
            command: List[str],
            project: Project,
            capture_output=True,
            shell=False,
            check=False,
            raise_exception=True,
            **kwargs,
    ):
        try:
            logger.info(f"Running command: {command}")
            completed_process = subprocess.run(
                command,
                cwd=project.path(),
                capture_output=capture_output,
                shell=shell,
                check=check,
                **kwargs,
            )
            if completed_process.stdout:
                for line in completed_process.stdout.decode().strip().split("\n"):
                    logger.info(line)
            if raise_exception:
                # In cases Pytest could not find any tests it returns code 5
                assert completed_process.returncode == 0 or completed_process.returncode == 5
        except AssertionError:
            raise TitanCliError(f"Error Running command={command} in project={project.name}")

    @staticmethod
    def install(project: Project):
        command = ["poetry", "install"]

        logger.info(f"Installing {project.type.value}: {project.name}")
        logger.info(f"Installing project at: {project.path()}")
        Poetry.run_command(command, project)

    @staticmethod
    def run_docs(docs_command: MkDocsCommand, project: Project, projects: List[Project]):
        command = ["mkdocs", docs_command.value, "-f", "docs/mkdocs.yml"]
        Poetry.run_command(
            command=command,
            project=project,
            env=dict(
                PYTHONPATH=f'{sys.path}:{":".join([str(p.path()) for p in projects])}',
                **os.environ,
            ),
            capture_output=False,
        )

    @staticmethod
    def test(project: Project, projects: List[Project]):
        dependencies = [proj for proj in projects if proj.type in get_project_deps(project.type)]

        command = ["poetry", "run", "pytest"]
        logger.info(f"Testing {project.type.value}: {project.name}")
        Poetry.run_command(command=command, project=project,
                           env=dict(
                               PYTHONPATH=f'{sys.path}:{":".join([str(deps.path()) for deps in dependencies])}',
                               **os.environ,
                           ))

    @staticmethod
    def remove(project: Project):
        command = ["poetry", "env", "remove", "3.9"]

        logger.info(f"Removing environment {project.type.value}: {project.name}")
        Poetry.run_command(command, project, raise_exception=False)

    @staticmethod
    def build(project: Project):
        command = ["poetry", "build"]

        logger.info(f"Building project {project.name}")
        Poetry.run_command(command, project, raise_exception=False)

    @staticmethod
    def bump_patch_version(project: Project):
        command = ["poetry", "version", VersionPart.PATCH]

        logger.info(f"Bumping patch version for {project.name}")
        Poetry.run_command(command, project, raise_exception=False)

    @staticmethod
    def publish(project: Project):
        command = ["poetry", "publish", "-r", "artifact"]

        logger.info(f"Publishing {project.name}")
        Poetry.run_command(command, project, raise_exception=False)
