# API

SiX API service

## Development

### Requirements

 * Python 3.13 or higher is required to run Generation.
 * Poetry, a package manager for Python, is required to install the necessary dependencies.

### Installation

```bash
poetry install --with dev --all-extras
```

When developing locally, `generate-entities` and `random-job` scripts will be invoked by the API service.
This means that generation is installed as a dependency of the API service when installing with the `generation` extra.

### Run server

```commandline
python main.py run-server
```

### Initialize DB

```commandline
python main.py init-db
```

### Drop DB

```commandline
python main.py drop-db
```

### Update Client Event Info
    
```commandline
python main.py save-event-info
```