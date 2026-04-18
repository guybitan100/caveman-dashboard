FROM python:3.13-slim

ARG VERSION
ARG POETRY_VERSION=1.8.3
ENV SIX_VERSION=$VERSION

RUN  apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
    poetry config virtualenvs.create false

WORKDIR /six

RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

ENV SIX_DB_DOCUMENT_DB_CERT_PATH=/six/global-bundle.pem

COPY src/backend/lib /six/src/backend/lib
COPY src/clients /six/src/clients
COPY src/backend/services/generation/pyproject.toml /six/src/backend/services/generation/

WORKDIR /six/src/backend/services/generation

COPY src/backend/services/generation /six/src/backend/services/generation

RUN poetry install --no-interaction --extras generate_job

ENTRYPOINT ["python", "generation/handlers/generate_job.py"]
