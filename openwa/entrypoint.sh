#!/bin/sh
echo "Starting OpenWA..."

SESSION_DIR="/app/data/sessions"

# Initial cleanup
cleanup_locks() {
  if [ -d "$SESSION_DIR" ]; then
    find "$SESSION_DIR" -name "SingletonLock" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "SingletonCookie" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "SingletonSocket" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "LOCK" -type f -delete 2>/dev/null || true
  fi
}

cleanup_locks
echo "Initial lock cleanup done"

# Background lock cleaner - runs every 5 seconds to catch locks left by crashed sessions
(
  while true; do
    sleep 5
    cleanup_locks
  done
) &

# Trap to kill background cleaner on exit
trap 'kill %1' EXIT

exec node dist/main
