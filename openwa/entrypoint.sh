#!/bin/sh
echo "Starting OpenWA..."

# Clean up stale Chromium lock files from previous container runs
# (profile lock prevents new Chromium from starting if old process didn't release it)
SESSION_DIR="/app/data/sessions"
if [ -d "$SESSION_DIR" ]; then
  echo "Cleaning stale Chromium lock files..."
  find "$SESSION_DIR" -name "SingletonLock" -type f -delete 2>/dev/null || true
  find "$SESSION_DIR" -name "SingletonCookie" -type f -delete 2>/dev/null || true
  find "$SESSION_DIR" -name "SingletonSocket" -type f -delete 2>/dev/null || true
  find "$SESSION_DIR" -name "LOCK" -type f -delete 2>/dev/null || true
  # Remove any pid files left by dead chromium
  find "$SESSION_DIR" -name "chrome_*" -type d -empty -delete 2>/dev/null || true
  echo "Lock cleanup done"
fi

exec node dist/main
