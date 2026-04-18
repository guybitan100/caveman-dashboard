#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$SERVER_ROOT"

mkdir -p logs

echo "Starting server development services from $SERVER_ROOT"

echo "[1/2] Starting API service on port 8000..."
cd "$SERVER_ROOT/src/backend/services/api"
poetry run python main.py run-server > "$SERVER_ROOT/logs/api.log" 2>&1 &
API_PID=$!
echo "$API_PID" > "$SERVER_ROOT/logs/api.pid"

echo "[2/2] Starting Metafinder service on port 8001..."
cd "$SERVER_ROOT/src/backend/services/metafinder"
poetry run uvicorn metafinder.main:app --reload --port 8001 > "$SERVER_ROOT/logs/metafinder.log" 2>&1 &
METAFINDER_PID=$!
echo "$METAFINDER_PID" > "$SERVER_ROOT/logs/metafinder.pid"

cd "$SERVER_ROOT"

echo "Server services started"
echo "  API:        http://localhost:8000"
echo "  Metafinder: http://localhost:8001"
echo "  Logs:       $SERVER_ROOT/logs"
echo "Use bash server/scripts/stop-dev.sh to stop them."