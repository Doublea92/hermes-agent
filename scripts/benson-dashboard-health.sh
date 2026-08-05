#!/usr/bin/env bash
set -euo pipefail
PORT="${HERMES_DASHBOARD_PORT:-8765}"
base="http://127.0.0.1:$PORT"

login_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 "$base/login")"
protected_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 "$base/api/jarvis/overview")"

[[ "$login_code" == "200" ]] || { echo "FAIL login HTTP $login_code"; exit 1; }
[[ "$protected_code" == "401" ]] || { echo "FAIL unauthorized API HTTP $protected_code"; exit 1; }
echo "OK login=$login_code unauthorized_api=$protected_code port=$PORT"
