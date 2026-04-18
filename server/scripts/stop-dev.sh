#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$SERVER_ROOT"

stop_service() {
    local name="$1"
    local pid_file="$2"

    if [[ ! -f "$pid_file" ]]; then
        echo "$name is not running"
        return
    fi

    local pid
    pid="$(cat "$pid_file")"

    if kill "$pid" 2>/dev/null; then
        echo "Stopped $name"
    else
        echo "$name was not running"
    fi

    rm -f "$pid_file"
}

stop_service "API" "$SERVER_ROOT/logs/api.pid"
stop_service "Metafinder" "$SERVER_ROOT/logs/metafinder.pid"

echo "All tracked server services are stopped"