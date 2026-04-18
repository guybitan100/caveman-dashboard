# Metafinder

Metafinder is a service that holds metadata of various data types, to let SiX query and retrieve data for the generation of simulated extractions.

The metadata is stored in an OpenSearch cluster, wnd for file data types (Images, Videos, Audios, and Documents), the files are stored in an S3 bucket.

## Development

### Requirements

 * Python 3.13 or higher is required to run Metafinder.
 * Poetry, a package manager for Python, is required to install the necessary dependencies.

### Installation

```bash
poetry install --with dev --all-extras
```

### Running Metafinder

```bash
poetry run uvicorn metafinder.main:app --reload
```

### Testing

```bash
poetry run pytest
```