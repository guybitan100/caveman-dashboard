# Generation

This Project holds the core logic of Titan generation service. 
It is responsible for generation Titan Events and converting them into a UFDR


## Development

### Requirements

 * Python 3.13 or higher is required to run Generation.
 * Poetry, a package manager for Python, is required to install the necessary dependencies.

### Installation

```bash
poetry install --with dev --all-extras
```

### Running Scripts

There are 3 scripts that can be run:

1. `generate-entities` - This script generates entities for UI Storyboard
2. `generate-job` - Main script that generates Titan Events and converts them into UFDR
3. `random-job` - This script is used mainly by the `titan-clent` to generate a random Titan job.

All scripts entry points are located in the `generation/handlres` directory.

When developing locally, `generate-entities` and `random-job` scripts will be invoked by the API service.
The `generate-job` script should be invoked with the job-id logged by the API service, like so:


`genration/handlers/generate-job.py`
```python
if __name__ == "__main__":
    job_id = "job-id"
    db_utils.delete_job_phases(job_id='job_id')
    run_job(job_id)
```

### Dependencies Management

Each script has it's own dependencies, which are specified in the `extras` attribute of the `pyproject.toml` file.

```toml
[tool.poetry.extras]
genertae = ["Faker", "numpy", "xsdata", "smart-open", "titan_db", "metafinder_client", "geopy", "aiohttp", "tzdata"]
genertae_entities = ["Faker"]
genertae_job = ["numpy"]
```

this means that any dependency that isn't shared between the scripts should be added to the `extras` attribute and must be installed with the `--optional` flag.

To install the dependencies for the `generate-entities` script, run:

```bash
poetry install --extras generate_entities
```

to install generation with all dependencies, run:

```bash
poetry install --all-extras
```

### Testing

```bash
poetry run pytest
```