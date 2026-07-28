# Deploy en VPS propio (sin EasyPanel)

Migración desde EasyPanel a Docker Compose + Caddy directo en tu VPS.

## 1. Requisitos

- VPS con Ubuntu/Debian
- Acceso SSH como root
- Dominio `crm.seiva.com.py` apuntando a la IP del VPS

## 2. Setup inicial en el VPS

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Clonar repo
git clone https://github.com/unknown-sm/whatsapp-panel.git
cd whatsapp-panel

# Configurar .env
cp .env.vps.example .env
nano .env   # Editar: POSTGRES_PASSWORD, JWT_SECRET, WHATSAPP_VERIFY_TOKEN
```

## 3. DNS en Cloudflare

En Cloudflare DNS:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | crm | TU_IP_VPS | **DNS only** (gris) |

**Importante:** No Proxied (naranja). El SSL lo maneja Caddy dentro del VPS.

## 4. Deploy

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

Esto:
1. Verifica que el DNS apunte a tu VPS
2. Construye las imágenes Docker
3. Levanta Postgres + Backend + Caddy
4. Caddy obtiene certificado Let's Encrypt automáticamente (60 seg)

## 5. Verificar

```bash
curl https://crm.seiva.com.py/api/health
```

Debe responder: `{"status":"ok",...}`

## 6. Configurar Meta

En Meta → WhatsApp → Configuration → Webhook:

- Callback URL: `https://crm.seiva.com.py/webhook`
- Verify token: el que pusiste en `WHATSAPP_VERIFY_TOKEN`
- Suscribirse a `messages`

## Comandos útiles

```bash
# Ver logs en vivo
docker compose -f docker-compose.vps.yml logs -f backend

# Reiniciar backend
docker compose -f docker-compose.vps.yml restart backend

# Backup de base de datos
docker exec whatsapp-postgres pg_dump -U whatsapp whatsapp_panel > backups/backup-$(date +%Y%m%d).sql

# Restaurar backup
cat backups/backup-20260101.sql | docker exec -i whatsapp-postgres psql -U whatsapp whatsapp_panel

# Ver estado
docker compose -f docker-compose.vps.yml ps
```

## Migrar datos desde EasyPanel

Si tenés datos en el EasyPanel:

```bash
# En EasyPanel terminal
docker exec whatsapp-cmr_crm-whatsapp-whatsapp-db-1 pg_dump -U whatsapp whatsapp_panel > dump.sql

# En tu VPS
scp root@easypanel-vps:dump.sql .
cat dump.sql | docker exec -i whatsapp-postgres psql -U whatsapp whatsapp_panel
```

## Estructura

```
VPS
├── postgres (datos)
├── backend (Node + Express)
└── caddy (reverse proxy + SSL)
```
