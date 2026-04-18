#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$SERVER_ROOT"

mkdir -p logs

API_PORT="${TITAN_API_PORT:-8000}"
METAFINDER_PORT="${TITAN_METAFINDER_PORT:-8001}"
AI_GENERATOR_PORT="${AI_GENERATOR_PORT:-8002}"

export TITAN_API_PORT="$API_PORT"
export TITAN_API_URL="${TITAN_API_URL:-http://localhost:${API_PORT}}"
export TITAN_METAFINDER_HOST="${TITAN_METAFINDER_HOST:-http://localhost:${METAFINDER_PORT}}"
export UFDR_API_URL="${UFDR_API_URL:-$TITAN_API_URL}"

echo "Starting server development services from $SERVER_ROOT"

echo "[1/3] Starting API service on port ${API_PORT}..."
cd "$SERVER_ROOT/src/backend/services/api"
poetry run python main.py run-server > "$SERVER_ROOT/logs/api.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$SERVER_ROOT/logs/api.pid"

echo "[2/3] Starting Metafinder service on port ${METAFINDER_PORT}..."
cd "$SERVER_ROOT/src/backend/services/metafinder"
poetry run uvicorn metafinder.main:app --reload --port "$METAFINDER_PORT" > "$SERVER_ROOT/logs/metafinder.log" 2>&1 &
METAFINDER_PID=$!
echo "$METAFINDER_PID" > "$SERVER_ROOT/logs/metafinder.pid"

echo "[3/3] Starting AI Generator service on port ${AI_GENERATOR_PORT}..."
cd "$SERVER_ROOT/src/backend/services/ai-generator"
poetry run uvicorn ai_generator.app:app --reload --port "$AI_GENERATOR_PORT" > "$SERVER_ROOT/logs/ai-generator.log" 2>&1 &
AI_GENERATOR_PID=$!
echo "$AI_GENERATOR_PID" > "$SERVER_ROOT/logs/ai-generator.pid"

cd "$SERVER_ROOT"

echo "Server services started"
echo "  API:          http://localhost:${API_PORT}"
echo "  Metafinder:   http://localhost:${METAFINDER_PORT}"
echo "  AI Generator: http://localhost:${AI_GENERATOR_PORT}"
echo "  Logs:       $SERVER_ROOT/logs"
echo "Use bash server/scripts/stop-dev.sh to stop them."
