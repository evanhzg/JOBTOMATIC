#!/usr/bin/env bash
# Plonge — starts the API (FastAPI) and the UI (Vite). First run installs everything.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${PLONGE_API_PORT:-8000}"
UI_PORT="${PLONGE_UI_PORT:-5173}"

if [ ! -x "$DIR/backend/venv/bin/python" ]; then
  echo "→ Création de l'environnement Python…"
  python3 -m venv "$DIR/backend/venv"
fi
if ! "$DIR/backend/venv/bin/python" -c "import pymupdf, fastapi, websockets" 2>/dev/null; then
  echo "→ Installation des dépendances Python…"
  "$DIR/backend/venv/bin/python" -m pip install -q -r "$DIR/backend/requirements.txt"
fi
if [ ! -d "$DIR/frontend/node_modules" ]; then
  echo "→ Installation des dépendances de l'interface…"
  (cd "$DIR/frontend" && npm install --silent)
fi

cleanup() { echo; echo "Arrêt de Plonge…"; kill $(jobs -p) 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$DIR/backend" && "$DIR/backend/venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT") &
sleep 1.5
(cd "$DIR/frontend" && PLONGE_API="http://localhost:$API_PORT" npx vite --port "$UI_PORT") &

echo
echo "  Plonge tourne : http://localhost:$UI_PORT"
echo "  API & docs    : http://localhost:$API_PORT/docs"
echo "  Ctrl+C pour arrêter."
wait
