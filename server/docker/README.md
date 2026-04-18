
## Build Images

build titan dependencies image

```commandline
docker build -f docker/titan_dependencies.Dockerfile . -t titan_dependencies:latest
```

### Generate Job Image

```commandline
docker build -f docker/generate_job.Dockerfile . -t titan_generate_job
```

### Generate Entities Image

```commandline
docker build -f docker/generate_entities.Dockerfile . -t titan_generate_entities
```

### Random Job Image

```commandline
docker build -f docker/random_job.Dockerfile . -t titan_random_job
```

### API

```commandline
docker build -f docker/api.Dockerfile . -t titan_api
```

### MetaFinder

```commandline
docker build -f docker/metafinder.Dockerfile . -t titan_metafinder
```

## Run Images

### Generate Job

```commandline
docker run titan_generate_job
```

### Generate Entities

```commandline
docker run titan_generate_entities
```

### Random Job

```commandline
docker run titan_random_job
```

### API

```commandline
docker run -p 5050:5050 titan_api
```

### MetaFinder

```commandline
docker run -p 8000:8000 titan_metafinder
```
