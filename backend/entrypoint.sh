#!/bin/sh
# Ensure DB schema is applied on every start (idempotent + safe for existing data)
cd /app/backend
echo "=== Prisma db push (ensure tables exist) ==="
npx prisma db push --skip-generate 2>&1 || echo "WARNING: prisma db push failed - check DATABASE_URL. Starting anyway..."
echo "=== Starting server ==="
exec node /app/backend/dist/index.js
