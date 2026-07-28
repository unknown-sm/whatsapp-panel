#!/bin/bash
set -e

echo "=== Deploy WhatsApp Panel en VPS ==="
echo ""

if [ ! -f .env ]; then
  echo "[1/5] Creando .env desde .env.vps.example..."
  cp .env.vps.example .env
  echo "  ⚠ Edita .env con tus secretos antes de continuar"
  exit 1
fi

source .env

echo "[1/5] Verificando DNS de ${DOMAIN}..."
IP=$(dig +short "$DOMAIN" | head -1)
VPS_IP=$(curl -s https://api.ipify.org)
if [ "$IP" != "$VPS_IP" ]; then
  echo "  ⚠ DNS apunta a $IP, VPS es $VPS_IP"
  echo "  Cambia el registro A en Cloudflare a DNS only (gris) y que apunte a $VPS_IP"
  exit 1
fi
echo "  ✓ DNS correcto"

echo "[2/5] Creando directorios..."
mkdir -p backups uploads
echo "  ✓"

echo "[3/5] Copiando Caddyfile..."
cp Caddyfile.production Caddyfile
echo "  ✓"

echo "[4/5] Build y start de servicios..."
docker compose -f docker-compose.vps.yml up -d --build
echo "  ✓"

echo "[5/5] Esperando que Caddy obtenga certificado..."
sleep 30

echo ""
echo "=== Deploy completo ==="
echo "  URL: https://${DOMAIN}"
echo "  Health: https://${DOMAIN}/api/health"
echo ""
echo "Próximos pasos:"
echo "  1. Configurar webhook de Meta con https://${DOMAIN}/webhook"
echo "  2. Verificar DNS en Cloudflare (modo DNS only, no Proxied)"
