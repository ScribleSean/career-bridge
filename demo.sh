#!/bin/sh
# Start Career Bridge for a demo: builds the data if missing, starts the server, opens the browser.
# Usage: ./demo.sh [port]     (needs the event data at ./sgi_dataset or $SGI_DATA)
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
PY="${PYTHON:-python3}"
if [ ! -f data/careerbridge.json ]; then
  echo "Building data (first run)..."
  "$PY" pipeline/build.py || exit 1
fi
URL="http://localhost:$PORT/#/job/43-4051"
( sleep 1; command -v open >/dev/null && open "$URL" || echo "Open $URL" ) &
exec "$PY" server.py --port "$PORT"
