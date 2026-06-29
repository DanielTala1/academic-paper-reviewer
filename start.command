#!/bin/bash
# macOS / Linux launcher for the Academic Paper Reviewer.
# Double-click this file in Finder, or run:  bash start.command
# It sets up an isolated environment (avoiding macOS "externally-managed-environment"
# errors), installs dependencies, starts the server, and opens the app.

cd "$(dirname "$0")" || exit 1

echo "Starting Academic Paper Reviewer..."

# Find a Python 3 interpreter.
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo
  echo "ERROR: Python 3 is not installed."
  echo "Install it from https://www.python.org/downloads/ and run this again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

# Create a local virtual environment on first run.
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment (first run only)..."
  "$PY" -m venv .venv || { echo "Failed to create virtual environment."; read -n 1 -s -r -p "Press any key to close..."; exit 1; }
fi

VENV_PY=".venv/bin/python"

echo "Installing dependencies (first run may take a minute)..."
"$VENV_PY" -m pip install --upgrade pip >/dev/null 2>&1
"$VENV_PY" -m pip install -r requirements.txt || { echo "Failed to install dependencies."; read -n 1 -s -r -p "Press any key to close..."; exit 1; }

echo
echo "Opening http://127.0.0.1:8000 ..."
( sleep 2 && (command -v open >/dev/null 2>&1 && open "http://127.0.0.1:8000" || true) ) &

"$VENV_PY" -m uvicorn main:app --host 127.0.0.1 --port 8000
