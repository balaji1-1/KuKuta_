#!/usr/bin/env bash
set -e

# dev.sh — start frontend (background) and Django runserver (foreground)
# Usage: ./dev.sh
# Environment variables:
#  FRONTEND_DIR  (default: kukuta.com)
#  FRONTEND_CMD  (default: npm run dev)
#  FRONTEND_LOG  (default: <FRONTEND_DIR>/frontend.log)

FRONTEND_DIR="${FRONTEND_DIR:-kukuta.com}"
FRONTEND_CMD="${FRONTEND_CMD:-npm run dev}"
FRONTEND_LOG="${FRONTEND_LOG:-$FRONTEND_DIR/frontend.log}"

mkdir -p "$(dirname "$FRONTEND_LOG")" || true

echo "Starting frontend: $FRONTEND_CMD in $FRONTEND_DIR — logging to $FRONTEND_LOG"
(
  cd "$FRONTEND_DIR" || exit 1
  # run in background and redirect output to log
  eval "$FRONTEND_CMD" >> "$FRONTEND_LOG" 2>&1 &
)

# start Django runserver in foreground
python manage.py runserver
