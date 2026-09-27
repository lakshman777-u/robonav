#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Starting RoboNav Autonomous Indoor Robot Platform..."

# Kill any existing instances first
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true
sleep 1

# Start Backend
export PATH="$HOME/.local/bin:$PATH"
cd "$DIR/backend"
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID) on http://0.0.0.0:8000"

# Start Frontend
export PATH="/home/obito/.local/share/fnm:$PATH"
eval "$(fnm env)"
cd "$DIR/frontend"
nohup npm run dev -- --host 0.0.0.0 --port 5173 > "$DIR/frontend/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID) on http://0.0.0.0:5173"

echo $BACKEND_PID > "$DIR/.backend.pid"
echo $FRONTEND_PID > "$DIR/.frontend.pid"

echo ""
echo "=========================================================="
echo " RoboNav Platform is running!"
echo " Web UI:     http://localhost:5173"
echo " API Docs:   http://localhost:8000/docs"
echo " Logs:       $DIR/backend/backend.log"
echo "             $DIR/frontend/frontend.log"
echo " Admin:      ROBO_NAV Admin / ECE4 BT 8"
echo " User:       user / user112233"
echo "=========================================================="
