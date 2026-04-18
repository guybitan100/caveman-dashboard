# Titan CLI

Titan CLI is an application for managing and building services, libraries and clients.
It provides commands for installing, building, serving, testing and removing projects.

This copy was moved from the legacy `tmp/Titan` snapshot and adjusted to the current repository layout:

- backend libs and services are resolved under `server/`
- backend clients are resolved under `server/src/clients/`
- generated docs, when available, are copied into `web/public/docs/`

## Usage

### Install

Install the libraries, services and/or clients:

```commandline
titan install --lib --client
```

### Build Documentation

Build documentation for the main project and all the projects that it depends on:

```commandline
titan build-docs
```

### Serve Documentation

Serve the documentation for the main project and all the projects that it depends on:

```commandline
titan serve-docs
```

### Test

Run the tests for all the projects:

```commandline
titan test
```

### Remove

Remove all the projects:

```commandline
titan remove
```

### Publish

Publish all the libraries, services and clients:

> **NOTE**
>
> Will Update all packages by their patch version and build them.
>
> A login to AWS CodeArtifact must be made before:
>
> ```commandline
> export POETRY_REPOSITORIES_ARTIFACT_URL=$(aws codeartifact get-repository-endpoint --domain cellebrite --domain-owner 983918838720 --repository titan --format pypi --query 'repositoryEndpoint' --output text)
> export POETRY_HTTP_BASIC_ARTIFACT_USERNAME=aws
> export POETRY_HTTP_BASIC_ARTIFACT_PASSWORD=$(aws codeartifact get-authorization-token --domain cellebrite --domain-owner 983918838720 --query 'authorizationToken' --output text)
> ```

```commandline
titan publish
```
