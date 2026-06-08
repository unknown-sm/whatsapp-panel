#!/bin/sh
echo "Starting OpenWA..."

SESSION_DIR="/app/data/sessions"

# Kill any zombie Chrome processes
kill_zombie_chrome() {
  pkill -9 -f chrome 2>/dev/null || true
  pkill -9 -f chromium 2>/dev/null || true
  sleep 1
}

# Aggressive lock cleanup
cleanup_locks() {
  if [ -d "$SESSION_DIR" ]; then
    find "$SESSION_DIR" -name "SingletonLock" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "SingletonCookie" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "SingletonSocket" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "LOCK" -type f -delete 2>/dev/null || true
    find "$SESSION_DIR" -name "*.lock" -type f -delete 2>/dev/null || true
  fi
}

# Initial cleanup
kill_zombie_chrome
cleanup_locks
echo "Initial cleanup done"

# Background cleaner - runs every 2 seconds
(
  while true; do
    sleep 2
    cleanup_locks
  done
) &

# Trap to kill background cleaner on exit
trap 'kill %1 2>/dev/null; kill_zombie_chrome' EXIT

exec node dist/main
