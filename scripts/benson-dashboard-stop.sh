#!/usr/bin/env bash
set -euo pipefail

PID_FILE="${BENSON_RUN_DIR:-/opt/data/.hermes/run}/benson-dashboard.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "Benson dashboard is not running (no PID file)"
  exit 0
fi
pid="$(<"$PID_FILE")"
if ! kill -0 "$pid" 2>/dev/null; then
  echo "Removing stale Benson dashboard PID file"
  rm -f "$PID_FILE"
  exit 0
fi

kill "$pid"
for _ in {1..20}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Benson dashboard stopped"
    exit 0
  fi
  sleep 0.25
done

echo "Benson dashboard did not stop gracefully; no forced kill was issued" >&2
exit 1
