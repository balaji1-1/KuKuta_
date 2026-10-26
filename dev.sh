#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.venv/bin/activate" ]; then
  . "$SCRIPT_DIR/.venv/bin/activate"
elif [ -f "$HOME/OneDrive/project k.com/.venv/bin/activate" ]; then
  . "$HOME/OneDrive/project k.com/.venv/bin/activate"
fi

cd "$SCRIPT_DIR/kukuta.com"
echo "Starting Kukuta React and Django development servers..."
npm run dev
