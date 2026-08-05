#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${BENSON_PROJECT_ROOT:-/opt/data/hermes-agent}"
PYTHON="${BENSON_PYTHON:-/opt/hermes/.venv/bin/python}"
HOST="${HERMES_DASHBOARD_HOST:-0.0.0.0}"
PORT="${HERMES_DASHBOARD_PORT:-8765}"
RUN_DIR="${BENSON_RUN_DIR:-/opt/data/.hermes/run}"
LOG_DIR="${BENSON_LOG_DIR:-/opt/data/.hermes/logs}"
PID_FILE="$RUN_DIR/benson-dashboard.pid"
LOG_FILE="$LOG_DIR/benson-dashboard.log"

mkdir -p "$RUN_DIR" "$LOG_DIR"
if [[ -f "$PID_FILE" ]] && kill -0 "$(<"$PID_FILE")" 2>/dev/null; then
  echo "Benson dashboard already running (PID $(<"$PID_FILE"))"
  exit 0
fi
rm -f "$PID_FILE"

if ! "$PYTHON" - "$HOST" "$PORT" <<'PY'
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
s = socket.socket()
try:
    s.bind((host, port))
except OSError as exc:
    raise SystemExit(f"Port check failed for {host}:{port}: {exc}")
finally:
    s.close()
PY
then
  exit 1
fi

cd "$PROJECT_ROOT"
export HOME=/opt/data
export PYTHONPATH="$PROJECT_ROOT${PYTHONPATH:+:$PYTHONPATH}"
export HERMES_WEB_DIST="${HERMES_WEB_DIST_OVERRIDE:-$PROJECT_ROOT/hermes_cli/web_dist}"
nohup "$PYTHON" -m hermes_cli.main dashboard --host "$HOST" --port "$PORT" --no-open >>"$LOG_FILE" 2>&1 &
pid=$!
echo "$pid" > "$PID_FILE"

for _ in {1..30}; do
  if curl --silent --fail --max-time 2 "http://127.0.0.1:$PORT/login" >/dev/null; then
    echo "Benson dashboard started (PID $pid, port $PORT)"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Benson dashboard exited during startup. See $LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "Benson dashboard did not become ready within 30 seconds" >&2
kill "$pid" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1
