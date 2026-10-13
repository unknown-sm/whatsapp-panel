# Auditoría Técnica — Crm_Whatsapp

**Fecha:** 2026-10-12 (actualizada 2026-10-13 tras remediación) · **Commit base:** `5c27ab4d` · **Alcance:** seguridad, dependencias, infraestructura, arquitectura y calidad.
**Método:** verificación línea a línea sobre el código + `npm audit` + `tsc --noEmit` + graphify. Evidencia en `archivo:línea`.

---

## Resumen ejecutivo (estado al 2026-10-13)

**Remediación completa de P0 y P1, más hardening de infra P2.** Desde la auditoría se cerraron: el IDOR multi-tenant (C5), `/uploads` público (A1), los `db push` destructivos del arranque (A6), el CORS abierto, el límite JSON de 50 MB, el webhook fail-open en producción, y el critical de `proxy-addr`. Backend y frontend compilan con **0 errores** y ambos builds de producción pasan.

**Estado:** 0 críticos · 0 altos abiertos · medios menores en backlog (P2 restante).

### Verificación de hallazgos — estado final

| ID | Hallazgo | Estado |
|---|---|---|
| C1 | Webhook Meta sin firma | ✅ Corregido (2026-09) + **fail-closed en prod desde 2026-10-12** (`whatsapp.controller.ts` rechaza sin `META_APP_SECRET`) |
| C2 | JWT con fallback público | ✅ Corregido |
| C3 | Clave de cifrado con fallback | ✅ Corregido + `ENCRYPTION_KEY` obligatoria en los 3 compose (`:?`) |
| C4 | Socket.io sin auth | ✅ Corregido |
| C5 | **IDOR multi-tenant** | ✅ **CORREGIDO 2026-10-12** — ver §1 |
| A1 | `/uploads` público sin fileFilter | ✅ **CORREGIDO 2026-10-12** — ver §2 |
| A2 | API keys IA en plano | ✅ Corregido |
| A3 | OpenWA apiKey/SSRF | ✅ Eliminado del stack |
| A4 | Credenciales default | 🟡 Parcial — registro público crea ADMIN de org nueva sin verificación de email (**decisión de producto pendiente**) |
| A5 | JWT en localStorage, sin revocación | ❌ Abierto (P2: cookie httpOnly + revocación) |
| A6 | `db push --accept-data-loss` en arranque | ✅ **CORREGIDO 2026-10-12** — ver §3 |
| A7 | Dependencias vulnerables | 🟡 backend 3 moderate (`mammoth`, requiere breaking) · frontend 2 moderate (`react-router`) · dashboard 0. Critical `proxy-addr` eliminado |

---

## 1. C5-IDOR multi-tenant — CORREGIDO (2026-10-12)

Patrón aplicado: helper `backend/src/lib/tenant.ts` (`requireOrgId` → 403 si el usuario no tiene org) + verificación de propiedad (404 si el recurso no es de la org) en todas las operaciones:

- **Conversaciones** (`conversation.controller.ts`): `getConversation`, `sendMessage`, `assignAgent`, `updateStatus`, `sendMedia` verifican `orgId` antes de operar. Ya no se puede leer ni enviar WhatsApp real a conversaciones de otra org.
- **Contactos**: `listContacts`/`exportContacts` filtran por org; `importContacts` crea con `orgId` y no reasigna contactos ajenos; `deleteContact`, `addNote`, `addTag`, `removeTag` verifican propiedad.
- **Bots** (`bot.service.ts`): orgId obligatorio en get/create/update/delete/keywords/setDefault/test; deletes vía `deleteMany({id, orgId})`.
- **Broadcasts** (`broadcast.service.ts`): orgId obligatorio en templates y broadcasts (list/get/update/delete/send); el cron interno sigue sin org (llamada interna).
- **Templates Meta** (`template.service.ts`): aislados por org; `syncWithMeta` asigna a la org que sincroniza.
- **Custom fields**: valores protegidos por verificación de contacto. ⚠️ Las definiciones siguen globales (el modelo `CustomField` no tiene `orgId` en el schema — requiere migración, backlog P2).
- **Bonus:** export CSV neutraliza fórmulas (`= + - @` → prefijo `'`) — cierra el CSV injection.

## 2. A1 — `/uploads` — CORREGIDO (2026-10-12)

- Multer con **allowlist MIME** (solo tipos que Meta soporta); rechazo limpio con 400 JSON en `conversation.routes.ts`.
- Nombres `Date.now()` + `crypto.randomBytes(16)` (antes `Math.random()` adivinable).
- Servido con `nosniff` + `CSP: sandbox`; `.html/.svg/.xml/.js` se fuerzan a `application/octet-stream` + `attachment` (`index.ts`).
- Montado **después** del rate limiter global (antes quedaba fuera).
- Volúmenes `whatsapp-uploads` agregados en `docker-compose.yml` y `docker-compose.dokploy.yml` (la media se perdía en cada recreación del contenedor).

## 3. A6 — Schema de DB — CORREGIDO (2026-10-12)

- `entrypoint.sh`: `prisma db push` **fail-closed** (`exit 1` si falla o requiere `--accept-data-loss`).
- `index.ts`: eliminado el segundo `db push --accept-data-loss` in-process y su `execSync`; arranque aborta sin `DATABASE_URL`.
- Ya no existe ningún push destructivo en el arranque.

## 4. Otros ítems cerrados (2026-10-12/13)

- **CORS**: producción solo orígenes de `CORS_ORIGINS`; sin la var, solo same-origin (middleware Origin==Host). Dev sigue abierto.
- **JSON global**: 50 MB → 5 MB (media va por multer); raw body preservado para la firma HMAC.
- **Headers Caddy**: HSTS, XFO/frame-ancestors, CSP, nosniff, Referrer-Policy, Permissions-Policy, sin `Server`/`X-Powered-By`.
- **`.dockerignore`**: excluye `.env*`, `backups/`, `*.sql`, `uploads/`, `e2e/`, `dashboard/`, `n8n/`.
- **`.gitignore`**: `backups/` y `*.sql`.
- **Dockerfile**: `USER node` (era root), uploads con ownership correcto.
- **`npm audit fix`** backend: critical `proxy-addr` eliminado.
- **Tipos**: backend y frontend `tsc --noEmit` en **0 errores** (se corrigieron 60 errores del frontend, incluidos 2 bugs de runtime: `AlertTriangle` faltante en Conversations y `t()` sin declarar en WebhookSettings).
- **Builds**: `vite build` y `tsc` backend pasan.

## 5. Funcionalidad agregada (2026-10-13)

- **Conexión con Meta en 1 click**: botón en Settings que lanza el Embedded Signup con el FB JS SDK (`config_id` por `META_CONFIG_ID`), reemplazando el pegado manual del code. Fallback manual conservado. Endpoint `GET /api/whatsapp/signup-config` (admin).
- **Coexistence** verificada: detección vía `is_on_biz_app` + `platform_type`, preferencia del número coexistence en el signup, y aviso de limitaciones en la UI.

---

## 6. Backlog restante (P2)

1. JWT a cookie httpOnly + revocación (cargar usuario desde BD en middleware) — impacta frontend.
2. `orgId` en modelo `CustomField` (migración de schema) para aislar definiciones.
3. Decisión de producto: registro público auto-crea ADMIN de org nueva (¿deshabilitar o verificación de email?).
4. Upgrades breaking: multer 2, Prisma 6, react-router 7.17+, mammoth.
5. Code-splitting del bundle frontend (618 kB → `React.lazy` por ruta).
6. `.graphifyignore` con `locales/`, `package.json`, `tsconfig*`.

## 7. Checklist de producción (no verificable desde el repo)

- [ ] Envs: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY` (32+), `META_APP_SECRET`, `CORS_ORIGINS`, `WEBHOOK_BASE_URL` — obligatorias, el contenedor no arranca sin ellas.
- [ ] Meta App Dashboard: webhook suscrito a `messages`, Embedded Signup habilitado, `META_APP_ID`/`META_CONFIG_ID` para el signup 1-click.
- [ ] Backups de Postgres en cron + copia fuera del servidor.
- [ ] Rotar: contraseña Postgres, verify token, passwords de admins creados antes de los fixes.
- [ ] Prueba de humo post-deploy: mensaje real, upload de imagen, bot, webhook suscrito.
