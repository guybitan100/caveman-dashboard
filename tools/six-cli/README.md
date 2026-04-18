# Six CLI

Six CLI is an application for managing and building services, libraries and clients. 
It provides commands for installing, building, serving, testing and removing projects.

## Usage

### Install

Install the libraries, services and/or clients:

```commandline
six install --lib --client
```

### Build Documentation

Build documentation for the main project and all the projects that it depends on:

```commandline
six build-docs
```

### Serve Documentation

Serve the documentation for the main project and all the projects that it depends on:

```commandline
six serve-docs
```

### Test

Run the tests for all the projects:

```commandline
six test
```

### Remove

Remove all the projects:

```commandline
six remove
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
> export POETRY_REPOSITORIES_ARTIFACT_URL=$(aws codeartifact get-repository-endpoint --domain cellebrite --domain-owner 983918838720 --repository six --format pypi --query 'repositoryEndpoint' --output text)
> export POETRY_HTTP_BASIC_ARTIFACT_USERNAME=aws
> export POETRY_HTTP_BASIC_ARTIFACT_PASSWORD=$(aws codeartifact get-authorization-token --domain cellebrite --domain-owner 983918838720 --query 'authorizationToken' --output text)
> ```

```commandline
six publish
```