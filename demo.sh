#!/bin/sh
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
PY="${PYTHON:-python3}"
[ -f data/atlas.json ] || { echo "Building open data (first run)..."; "$PY" pipeline/atlas.py || exit 1; }
if [ ! -f data/careerbridge.json ] && [ -f "${SGI_DATA:-sgi_dataset}/lightcast/lc_occupation_ai_profile.csv" ]; then
  echo "Building Lightcast data (first run)..."
  "$PY" pipeline/build.py || exit 1
fi
URL="http://localhost:$PORT/#/job/43-6014"
( sleep 1; command -v open >/dev/null && open "$URL" || echo "Open $URL" ) &
exec "$PY" server.py --port "$PORT"
