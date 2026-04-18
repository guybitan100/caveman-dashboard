# UFDR Runtime

This service is not implemented in the imported Titan backend snapshot, but the web app already expects it as a standalone backend service.

## Expected HTTP Contract

The UI calls these endpoints:

- `GET /api/health` -> `{ ok: boolean }`
- `GET /api/info` -> app metadata and available UFDR count
- `GET /api/system/stats` -> hostname, uptime, memory, load average, Node version
- `GET /api/ufdr/files` -> `{ files: LocalUfdrFile[] }`
- `GET /api/ufdr/jobs/current` -> current `RuntimeJobSnapshot`
- `POST /api/ufdr/summary` -> `{ commandLine, output }`
- `POST /api/ufdr/run` -> `RuntimeJobSnapshot`
- `POST /api/ufdr/jobs/current/cancel` -> `RuntimeJobSnapshot`
- `POST /api/restart` -> `{ ok: boolean }`
- `POST /api/reset` -> `{ ok: boolean }`

## Required Data Shapes

The current UI expects the types defined in `web/src/types/ufdrRuntime.ts`:

- `LocalUfdrFile` with `name`, `path`, `size`, `modifiedAt`
- `RuntimeJobSnapshot` with `status`, `commandLine`, `logs`, timestamps, exit code, and cancellation state
- `AppInfo` with `appName`, `pythonCommand`, `runtimeRoot`, `availableUfdrs`
- `SystemStats` with `hostname`, `nodeVersion`, `uptimeSeconds`, `memoryUsedPercent`, `loadAverage`

## Missing Responsibilities

An implementation still needs to provide:

- local UFDR inventory scanning
- job process execution and log capture
- cancellation and reset behavior
- runtime restart behavior
- host/system metrics collection
- support for both local-file and S3-backed execution payloads

## Suggested Local Defaults

- service port: `8081`
- root URL consumed by the web app: `http://localhost:8081`

Keeping this placeholder under `server/src/backend/services/ufdr-runtime/` makes the missing service explicit in the same backend structure as the imported API, Metafinder, and AI generator services.
