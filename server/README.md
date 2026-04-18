# Server

This directory now contains the backend logic imported from the Titan snapshot that previously lived under `tmp/Titan`.

## Layout

- `src/backend/lib/` shared Python packages used across the services
- `src/backend/services/` deployable services and server-side handlers
- `src/backend/services/ufdr-runtime/` placeholder contract for the missing runtime service
- `src/clients/` local Python client packages referenced by backend services
- `src/utils/` standalone backend-adjacent utilities recovered from the Titan snapshot
- `docker/` Dockerfiles for backend deployments
- `scripts/validate-connectivity/` backend connectivity validation tooling
- `example.env` example backend environment configuration

## Services

- `api/` FastAPI + Typer service for jobs, DB initialization, and manager APIs
- `metafinder/` FastAPI service for metadata lookup
- `generation/` generation job handlers and scripts
- `ai-generator/` AI generation service package
- `llm-gateway/` LiteLLM proxy package
- `location_thumbnail/` Node-based thumbnail helper
- `ufdr-runtime/` placeholder for the still-missing runtime backend

## Local Development

Prerequisites:

- Python 3.13+
- Poetry
- Node.js 18+ for `location_thumbnail`

Start the core long-running backend services:

```bash
npm run server:start
```

This starts:

- API on `http://localhost:8000`
- Metafinder on `http://localhost:8001`
- AI Generator on `http://localhost:8002`

Stop them with:

```bash
npm run server:stop
```

Logs are written to `server/logs/`.

## Notes

- Copy `server/example.env` to `server/.env` and fill the backend-specific values before starting services.
- `server/scripts/start-dev.sh` pins the local development URLs used by the web app and by the backend service-to-service calls.
- The imported backend tree preserves the original relative paths used by the service `pyproject.toml` files.
- The separate UFDR runtime server used by `web/src/api/ufdrRuntimeApi.ts` was not present in the Titan snapshot and is still not implemented inside this repository.
- The missing runtime contract is documented in `server/src/backend/services/ufdr-runtime/README.md`.
