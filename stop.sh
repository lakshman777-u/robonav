#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -f "$DIR/.backend.pid" ]; then
    kill $(cat "$DIR/.backend.pid") 2>/dev/null || true
    rm -f "$DIR/.backend.pid"
fi

if [ -f "$DIR/.frontend.pid" ]; then
    kill $(cat "$DIR/.frontend.pid") 2>/dev/null || true
    rm -f "$DIR/.frontend.pid"
fi

pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true

echo "RoboNav platform stopped."
