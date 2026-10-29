#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  🚀 Starting JobHunter AGY (Antigravity Autopilot)"
echo "=========================================================="

# Trap to kill both processes on exit
cleanup() {
    echo ""
    echo "Stopping JobHunter AGY..."
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start Backend
echo "Starting Backend API (FastAPI + AGY Bridge)..."
cd "$DIR/backend"
"$DIR/backend/venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 1.5

# Start Frontend
echo "Starting Frontend UI (Vite + React)..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo "  ✅ JobHunter AGY is running!"
echo "  🌐 Open UI: http://localhost:5173"
echo "  🔌 API & Docs: http://localhost:8000/docs"
echo "=========================================================="
echo "Press Ctrl+C to stop both servers."

wait
