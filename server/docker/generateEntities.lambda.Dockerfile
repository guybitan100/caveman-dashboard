FROM public.ecr.aws/lambda/python:3.13

ARG VERSION
ARG POETRY_VERSION=1.8.3
ENV SIX_VERSION=$VERSION
ENV SIX_DB_DOCUMENT_DB_CERT_PATH=/dummy/path

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
    poetry config virtualenvs.create false

WORKDIR $LAMBDA_TASK_ROOT/six

COPY src/backend/lib $LAMBDA_TASK_ROOT/six/src/backend/lib
COPY src/clients $LAMBDA_TASK_ROOT/six/src/clients
COPY src/backend/services/generation/pyproject.toml $LAMBDA_TASK_ROOT/six/src/backend/services/generation/

WORKDIR $LAMBDA_TASK_ROOT/six/src/backend/services/generation

COPY src/backend/services/generation $LAMBDA_TASK_ROOT/six/src/backend/services/generation

RUN poetry install --no-interaction --extras generate_entities

CMD ["generation.handlers.generate_entities.handler"]
