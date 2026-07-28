# Deploy con Dokploy

Dokploy maneja HTTPS automático con Traefik. No necesitás Caddy ni Cloudflare proxy.

## 1. Requisitos

- Dokploy instalado en tu VPS ([dokploy.com](https://dokploy.com))
- Dominio `crm.seiva.com.py` apuntando a la IP del VPS (registro A en Cloudflare modo **DNS only**)

## 2. Crear proyecto en Dokploy

1. Login en Dokploy
2. **Projects** → **Create Project** → nombre: `whatsapp-crm`
3. Dentro del proyecto → **Services** → **Create Service** → **App**
4. **Source**:
   - Provider: **GitHub**
   - Repo: `https://github.com/unknown-sm/whatsapp-panel.git`
   - Branch: `master`
   - Build method: **Dockerfile**
5. Click **Deploy**

## 3. Variables de entorno

En el servicio → **Environment**:

```
NODE_ENV=production
PORT=4000
POSTGRES_PASSWORD=tu_password_postgres
JWT_SECRET=tu_secreto_jwt_64_chars
FRONTEND_URL=https://crm.seiva.com.py
WEBHOOK_BASE_URL=https://crm.seiva.com.py
WHATSAPP_VERIFY_TOKEN=seiva2026
```

Generá `JWT_SECRET` con: `openssl rand -hex 32`

## 4. Dominio

En el servicio → **Domains** → **Add Domain**:

- Host: `crm.seiva.com.py`
- Service: `whatsapp-panel`
- Port: `4000`
- HTTPS: **ON** (Let's Encrypt automático)

Dokploy configura Traefik + Let's Encrypt solo. Esperá 1-2 min.

## 5. Base de datos

Dokploy tiene Postgres como servicio. Crear:

1. **Services** → **Create Service** → **Database** → **PostgreSQL**
2. Username: `whatsapp`
3. Password: el mismo que `POSTGRES_PASSWORD`
4. Database: `whatsapp_panel`

La red interna de Dokploy expone Postgres como hostname `postgres`.

## 6. Variables finales del backend

Actualizá la variable `DATABASE_URL` si es necesario. Dokploy normalmente provee `DATABASE_URL` auto para servicios linked. Si no, usá:

```
DATABASE_URL=postgresql://whatsapp:TU_PASSWORD@postgres:5432/whatsapp_panel
```

## 7. Verificar

```
https://crm.seiva.com.py/api/health
```

Debe responder `{"status":"ok",...}`

## 8. Meta webhook

- Callback URL: `https://crm.seiva.com.py/webhook`
- Verify token: `seiva2026`
- Suscribirse a `messages`

## DNS en Cloudflare

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | crm | IP_VPS | **DNS only** (gris) |

## Migrar datos desde EasyPanel

```bash
# Desde EasyPanel terminal
docker exec whatsapp-cmr_crm-whatsapp-whatsapp-db-1 pg_dump -U whatsapp whatsapp_panel > dump.sql

# A tu VPS
scp root@easypanel-vps:dump.sql .

# En Dokploy terminal del servicio postgres
cat dump.sql | docker exec -i $(docker ps -qf "name=postgres") psql -U whatsapp whatsapp_panel
```
