FROM public.ecr.aws/lambda/python:3.13

ARG VERSION
ARG POETRY_VERSION=1.8.3
ENV SIX_VERSION=$VERSION

RUN pip install poetry==$POETRY_VERSION --no-cache-dir && \
    poetry config virtualenvs.create false

WORKDIR $LAMBDA_TASK_ROOT/six

RUN curl -o $LAMBDA_TASK_ROOT/six/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

ENV SIX_DB_DOCUMENT_DB_CERT_PATH=$LAMBDA_TASK_ROOT/six/global-bundle.pem

COPY src/backend/lib $LAMBDA_TASK_ROOT/six/src/backend/lib
COPY src/clients $LAMBDA_TASK_ROOT/six/src/clients

COPY src/backend/services/api/pyproject.toml $LAMBDA_TASK_ROOT/six/src/backend/services/api/
COPY src/backend/services/api/poetry.lock $LAMBDA_TASK_ROOT/six/src/backend/services/api/
COPY src/backend/services/api/api $LAMBDA_TASK_ROOT/six/src/backend/services/api/api

COPY src/backend/services/generation/pyproject.toml $LAMBDA_TASK_ROOT/six/src/backend/services/generation/
COPY src/backend/services/generation/poetry.lock $LAMBDA_TASK_ROOT/six/src/backend/services/generation/
COPY src/backend/services/generation/generation $LAMBDA_TASK_ROOT/six/src/backend/services/generation/generation

WORKDIR $LAMBDA_TASK_ROOT/six/src/backend/services/api

RUN poetry install --no-interaction

CMD ["api.handler.app_handler"]
