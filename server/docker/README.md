
## Build Images

build six dependencies image

```commandline
docker build -f docker/six_dependencies.Dockerfile . -t six_dependencies:latest
```

### Generate Job Image

```commandline
docker build -f docker/generate_job.Dockerfile . -t six_generate_job
```

### Generate Entities Image

```commandline
docker build -f docker/generate_entities.Dockerfile . -t six_generate_entities
```

### Random Job Image

```commandline
docker build -f docker/random_job.Dockerfile . -t six_random_job
```

### API

```commandline
docker build -f docker/api.Dockerfile . -t six_api
```

### MetaFinder

```commandline
docker build -f docker/metafinder.Dockerfile . -t six_metafinder
```

## Run Images

### Generate Job

```commandline
docker run six_generate_job
```

### Generate Entities

```commandline
docker run six_generate_entities
```

### Random Job

```commandline
docker run six_random_job
```

### API

```commandline
docker run -p 5050:5050 six_api
```

### MetaFinder

```commandline
docker run -p 8000:8000 six_metafinder
```
