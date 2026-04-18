FROM ghcr.io/berriai/litellm:v1.75.8-stable

ARG POETRY_VERSION=2.1.1

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
  poetry config virtualenvs.create false

WORKDIR /six

# Copy pyproject.toml and poetry.lock for caching
COPY src/backend/services/llm-gateway/pyproject.toml /six/src/backend/services/llm-gateway/
COPY src/backend/services/llm-gateway/poetry.lock /six/src/backend/services/llm-gateway/

WORKDIR /six/src/backend/services/llm-gateway

# Install dependencies
RUN poetry install --no-interaction --no-root

# Copy the application code (config.yaml, etc.)
COPY src/backend/services/llm-gateway /six/src/backend/services/llm-gateway

EXPOSE 80

ENTRYPOINT ["/app/docker/prod_entrypoint.sh"]

CMD ["--port", "80", "--config", "/six/src/backend/services/llm-gateway/config.yaml"]
