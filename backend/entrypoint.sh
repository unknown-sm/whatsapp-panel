#!/bin/sh
# Apply DB schema on start. Fail-closed: si el push requiere pérdida de datos
# o la DB no responde, el contenedor NO arranca (mejor caído que corrupto).
cd /app/backend
echo "=== Prisma db push (fail-closed) ==="
if ! npx prisma db push --skip-generate; then
  echo "ERROR: prisma db push falló o requiere --accept-data-loss. Revisá el schema y aplicá los cambios manualmente. No se inicia el servidor."
  exit 1
fi
echo "=== Starting server ==="
exec node /app/backend/dist/index.js
