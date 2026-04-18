FROM python:3.13-slim

ARG VERSION
ARG POETRY_VERSION=1.8.3
ENV TITAN_VERSION=$VERSION

RUN  apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
    poetry config virtualenvs.create false

WORKDIR /titan

RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

ENV TITAN_DB_DOCUMENT_DB_CERT_PATH=/titan/global-bundle.pem

COPY src/backend/lib /titan/src/backend/lib
COPY src/clients /titan/src/clients
COPY src/backend/services/generation/pyproject.toml /titan/src/backend/services/generation/

WORKDIR /titan/src/backend/services/generation

COPY src/backend/services/generation /titan/src/backend/services/generation

RUN poetry install --no-interaction --extras generate_job

ENTRYPOINT ["python", "generation/handlers/generate_job.py"]
