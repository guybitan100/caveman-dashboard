import subprocess
import shutil

import typer
from loguru import logger
from six_cli.poetry import MkDocsCommand, Poetry, SixCliError, VersionPart
from six_cli.projects import (
    NoSuchLibraryError,
    clients,
    get_library,
    libraries,
    main_project,
    projects,
    services,
)

app = typer.Typer()


@app.command("install")
def install(lib: bool = typer.Option(default=False), client: bool = typer.Option(default=False)):
    for service in services:
        Poetry.install(service)

    if lib:
        for library in libraries:
            Poetry.install(library)

    if client:
        for client in clients:
            Poetry.install(client)


@app.command("build-docs")
def build_docs():
    Poetry.run_docs(docs_command=MkDocsCommand.BUILD, project=main_project, projects=projects)
    # copy all file from docs/site to src/frontend/public/docs
    shutil.copytree("../../docs/site", "../../src/frontend/public/docs")



@app.command("serve-docs")
def serve_docs():
    Poetry.run_docs(docs_command=MkDocsCommand.SERVE, project=main_project, projects=projects)


@app.command("test")
def test():
    for service in projects:
        Poetry.test(service, projects=projects)


@app.command("remove")
def remove():
    for service in projects:
        Poetry.remove(service)


def _publish(project):
    Poetry.bump_patch_version(project)
    Poetry.build(project)
    Poetry.publish(project)


@app.command("publish")
def publish():
    for lib in libraries:
        _publish(lib)
    for client in clients:
        _publish(client)



if __name__ == "__main__":
    app()
