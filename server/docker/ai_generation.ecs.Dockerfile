FROM python:3.13-slim

ARG POETRY_VERSION=2.1.1

RUN apt-get update \
  && apt-get install -y wget \
  && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
  poetry config virtualenvs.create false

WORKDIR /six

# Download RDS CA bundle (needed by core library)
RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
ENV SIX_DB_DOCUMENT_DB_CERT_PATH=/six/global-bundle.pem

# Copy local dependencies first
COPY src/backend/lib /six/src/backend/lib

# Copy pyproject.toml and poetry.lock for caching
COPY src/backend/services/ai-generator/pyproject.toml /six/src/backend/services/ai-generator/
COPY src/backend/services/ai-generator/poetry.lock /six/src/backend/services/ai-generator/

WORKDIR /six/src/backend/services/ai-generator

# Install dependencies
RUN poetry install --no-interaction --no-root

# Copy the application code
COPY src/backend/services/ai-generator /six/src/backend/services/ai-generator

# Install the app itself
RUN poetry install --no-interaction

EXPOSE 80

CMD ["uvicorn", "ai_generator.app:app", "--host", "0.0.0.0", "--port", "80"]
