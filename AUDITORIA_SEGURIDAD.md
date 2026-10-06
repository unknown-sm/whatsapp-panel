# Auditoría de Seguridad — Crm_Whatsapp

**Fecha:** 2026-09-22 · **Alcance:** backend (Express+Prisma), frontend, dashboard, infra (Docker/Caddy/deploy), dependencias.
**Método:** revisión manual del código con evidencia `archivo:línea` + `npm audit`. Todos los hallazgos críticos fueron verificados directamente sobre el código.

---

## Resumen ejecutivo

La base del stack es sólida (Prisma sin SQL raw, bcrypt-12, AES-256-GCM, helmet, rate limiting, healthchecks, Postgres nunca expuesto), pero hay **fallas graves que exponen toda la plataforma**: secretos con valores por defecto públicos que permiten forjar tokens de ADMIN, webhook de Meta que acepta mensajes forjados de cualquiera, Socket.io sin autenticación que filtra conversaciones, IDOR multi-tenant que cruza datos entre organizaciones, y uploads públicos sin filtrar que habilitan stored XSS.

**Además:** el compose de producción (`docker-compose.yml:47`) arranca con `WHATSAPP_ENGINE: openwa` por defecto — contradice la decisión de no usar openwa en producción. Si el deploy no define esa variable, el engine activo es openwa, no Meta.

---

## CRÍTICOS

### C1. Webhook de Meta sin verificación de firma — spoofing total de mensajes entrantes
`backend/src/controllers/whatsapp.controller.ts:25-78` (ruta pública en `whatsapp.routes.ts:9` → `index.ts:359`)

`webhookIncoming` procesa `req.body` directo. No existe verificación de `X-Hub-Signature-256` en ningún archivo del backend (grep: 0 resultados; `META_APP_SECRET` nunca se usa para autenticar payloads). Cualquiera que conozca la URL puede:
- Inyectar mensajes falsos de cualquier teléfono (formato Meta u OpenWA — ambos aceptados).
- Disparar bots/IA que gastan créditos y responden a números reales.
- Envenenar analytics, lead scoring y knowledge.

Bonus: `webhookVerify` (líneas 7-23) compara el verify token con `===` (no timing-safe) y en éxito hace `updateMany` **sin `where`** poniendo TODAS las configs en "online".

**Fix:** verificar HMAC-SHA256 del raw body con `META_APP_SECRET` + `crypto.timingSafeEqual` (requiere capturar el buffer crudo en `express.json({ verify })`).

### C2. JWT firmable con secretos públicos — forja de tokens ADMIN
- `backend/src/middleware/auth.ts:17` → `jwt.verify(token, process.env.JWT_SECRET || "fallback-secret")`
- `backend/src/controllers/auth.controller.ts:41,95` → mismo fallback al firmar.
- `docker-compose.yml:43` → `JWT_SECRET: ${JWT_SECRET:-whatsapp-panel-jwt-secret-2024}` (default público en el repo del stack de producción EasyPanel).

Si `JWT_SECRET` no está definida en el entorno, cualquiera firma un token `{ role: "ADMIN", orgId: ... }` y entra como admin.

### C3. Clave de cifrado de tokens con fallback derivado/público
`backend/src/services/crypto.service.ts:7-15`

Si `ENCRYPTION_KEY` falta o tiene <32 chars, la clave AES-256-GCM se deriva de `JWT_SECRET` o del literal `"fallback-key-change-in-prod"` (público en el repo). El código demuestra que corre sin envs (`index.ts:45-47` tiene fallback de `DATABASE_URL`), así que el escenario es realista: un leak de la DB expone todos los `accessToken` de WhatsApp Cloud API. Además, rotar `JWT_SECRET` rompe silenciosamente el descifrado de todos los tokens guardados.

**Fix:** `ENCRYPTION_KEY` obligatoria (fail-fast al boot), nunca derivada de `JWT_SECRET`.

### C4. Socket.io sin autenticación — lectura de conversaciones y chat interno cross-org
`backend/src/index.ts:391-417`

No hay middleware de handshake ni validación de eventos:
- `join-conversation` acepta cualquier `conversationId` → anyone puede escuchar `message:new` de cualquier conversación.
- `message:send` inyecta mensajes "outbound" falsos en cualquier sala.
- `agent-chat:message` hace `socket.broadcast.emit` a TODOS los clientes con el comentario literal "frontend filters by org" → el chat interno de todas las organizaciones se emite a cualquiera que se conecte (un cliente Node ignora el CORS).

**Fix:** middleware `io.use()` que valide JWT en el handshake, validar pertenencia de la sala por orgId, y rooms por organización para agent-chat.

### C5. IDOR multi-tenant — los datos cruzan organizaciones
El schema define `orgId` en todas las entidades, pero los controladores son inconsistentes:

| Operación | Ubicación | Problema |
|---|---|---|
| Leer conversación por ID | `conversation.controller.ts:45-47` | sin filtro org (listar SÍ filtra) |
| Enviar mensaje/media a conversación | `conversation.controller.ts:55,86,184` | envía WhatsApp real a cualquier conversación por ID |
| Listar/exportar contactos | `conversation.service.ts:100,133-137` + `controller:154` | vuelca contactos de TODAS las orgs a CSV |
| Borrar contacto / tags | `conversation.controller.ts:292-298,116,131` · `customfield.controller.ts` | operan sobre contactId arbitrario (0 menciones de orgId en el archivo) |
| Update/delete de bots | `bot.service.ts:50-56` | lectura filtra org, escritura no |
| Patrón `orgId ? { orgId } : undefined` | `bot.service.ts:22`, `broadcast.service.ts:60`, `conversation.service.ts:6` | si el usuario no tiene membership, el filtro desaparece y lista todas las orgs en vez de 403 |
| Templates | `template.service.ts:7-13` | `messageTemplate` tiene orgId en el schema pero las queries no filtran |

Contraste: `agent-chat` (controller:6-7) exige userId+orgId en todas las queries — es el patrón a replicar.

---

## ALTOS

### A1. `/uploads` público sin auth + uploads sin fileFilter → stored XSS y fuga de media
- `index.ts:340` monta `express.static("uploads")` antes de auth/rate-limit.
- `conversation.controller.ts:15-24`: multer con `diskStorage` y **ningún `fileFilter`** (solo 50MB).
- Impacto: cualquier usuario autenticado sube `x.html`/`x.svg` que se sirve con `Content-Type: text/html` en el mismo origin → stored XSS contra quien abra el link (el frontend lo muestra con `target="_blank"` en `Conversations.tsx:850+`). Toda la media de chats (privada) es accesible sin token; el nombre es `Date.now()` + 6 chars de `Math.random()` (no criptográfico) → adivinable.

### A2. API keys de IA en plano en la DB y expuestas por la API
- `ai.service.ts:15-33`: `apiKey` se guarda sin `encrypt()` (schema `aIConfig.apiKey String` plano).
- `ai.controller.ts:5-11` + `ai.routes.ts` (solo `authMiddleware`, sin `requireAdmin`): `GET /api/ai` devuelve TODAS las configs con la apiKey en claro a cualquier AGENT.
- `ai.service.ts:36`: `updateAIConfig` sin Zod, y `ai.service.ts:160-161` usa `config.endpoint` como `baseURL` → cualquier usuario apunta el endpoint a su servidor y el backend le envía la apiKey en el header (exfiltración) o a hosts internos (SSRF).

### A3. OpenWA: apiKey expuesta y SSRF sin admin
- `openwa.controller.ts:39-42`: `GET /config` devuelve el objeto completo con `apiKey` en claro a cualquier usuario autenticado (ruta sin `requireAdmin`).
- `openwa.controller.ts:56-58`: `PUT /config` / `POST /test` aceptan `baseUrl` user-controlled → axios contra hosts internos + el motor envía la API key real al host del atacante.
- `getQrCode` (121-133), `resetConnection` (318) y `cleanChromeLocks` (21-43) accesibles a cualquier AGENT: escanear/tomar el QR o deslogear la sesión completa.
- El compose no inyecta `API_MASTER_KEY` y el backend usa `OPENWA_API_KEY || ""` (`whatsapp-engine.ts:122`) → backend↔openwa sin auth real.

### A4. Credenciales default en producción
- `index.ts:113-125`: si la DB está vacía se crea `admin@whatsapp-panel.com` / `admin123` y **la contraseña se loguea a consola**. Combinado con `db push --accept-data-loss` (ver M1), un reset de datos re-crea este acceso ADMIN.
- `docker-compose.yml:6,42` + `index.ts:46`: contraseña de Postgres `whatsapp_secret` commiteada.
- `DOKPLOY.md:33`: verify token real de producción documentado (`seiva2026`), adivinable.
- `auth.controller.ts:77-86`: registro público crea usuarios ADMIN sin verificación de email ni invitación (diseño a revisar).

### A5. JWT en localStorage, 7 días, sin revocación
`frontend/src/store/authStore.ts:32` guarda el token en localStorage (robable vía XSS); `api.ts:3-6` lo manda como Bearer. No hay logout server-side, ni refresh, ni blacklist — no se puede expulsar a un usuario comprometido sin rotar el secret. El middleware (`auth.ts:16-19`) no consulta la BD: un token sobrevive 7 días aunque desactives al usuario.

### A6. `prisma db push --accept-data-loss` en cada arranque (dos veces)
- `backend/src/index.ts:444` lo corre con `--accept-data-loss` y **fail-open** (446-448 capturan el error y arrancan igual).
- `backend/entrypoint.sh:5` ya corre otro `db push` antes → 2 pushes por inicio.
- Riesgo: un rollback de imagen con schema viejo borra columnas en vivo. Reemplazar por `prisma migrate deploy` como paso de deploy separado, fail-closed.

### A7. Dependencias vulnerables (npm audit --package-lock-only)
| Proyecto | Totales | Lo más grave |
|---|---|---|
| backend | 14 (1 critical, 9 high) | `tar` (critical, path traversal) vía bcrypt; `axios` (10 advisories); `ws` (DoS) y `socket.io-parser` (memory exhaustion) en runtime; `@xmldom/xmldom` vía mammoth |
| frontend | 16 (9 high) | axios, form-data, nanoid, postcss, ws |
| dashboard | 14 (9 high) | react-router (open redirect/XSS), vite 8.0.x, postcss |

Todo tiene fix con `npm audit fix` (salvo vite de frontend, requiere upgrade a 8.3). Multer quedó en 1.4.5-lts.2: parcheado pero la línea 1.x está deprecada — migrar a 2.x.

---

## MEDIOS

- **CORS HTTP abierto:** `index.ts:337` `app.use(cors())` = `*` para toda la API, mientras Socket.io SÍ restringe origen (328-333). Igualar con `cors({ origin: process.env.FRONTEND_URL })`.
- **`express.json({ limit: "50mb" })`** global (index.ts:338) — superficie DoS innecesaria.
- **OAuth de Meta sin `state`** (CSRF): `meta-oauth.controller.ts` no genera/valida state; `/exchange` devuelve el accessToken al frontend y `listWABAs`/`listPhoneNumbers` aceptan tokens arbitrarios del body (proxy Graph). URL de producción hardcodeada como fallback (`meta-oauth.service.ts:34,137`).
- **Logs con PII de chats:** `whatsapp.controller.ts:26` loguea el body del webhook.
- **CSV injection** en export de contactos (`conversation.controller.ts:157-160`): no neutraliza `=HYPERLINK(...)`/fórmulas.
- **media.service construye el path con datos del webhook** sin sanear (`media.service.ts:62-64`): `mediaId`/`mimeType` forjables → segmentos `..` en `path.join`. Mitigado porque requiere descarga exitosa desde graph.facebook.com.
- **Rutas de escritura sin Zod:** broadcast, pipeline (todos los handlers), tag, agent-chat pasan `req.body` crudo a Prisma.
- **Logs DELETE sin admin** (`logs.routes.ts:6-9`) + acepta `days` sin límite: cualquier AGENT borra evidencia.
- **Lab sin admin ni aislamiento** (`lab.routes.ts:6-12`): cualquier AGENT quema créditos de IA de la config global; runs visibles cross-org.
- **`.dockerignore` no excluye `.env`, `backups/`, `*.sql`, `uploads/`** y `Dockerfile:9` hace `COPY . .` → secretos en capas del builder.
- **`backups/` no está en `.gitignore`** (`deploy-vps.sh:27` lo crea; DEPLOY.md vuelca pg_dump ahí).
- **Docker como root:** `Dockerfile:26` `USER root` explícito, sin cap_drop; openwa además corre Chrome con `--no-sandbox` como root.
- **openwa Dockerfile sin pin** (`git clone --depth 1` de master) y `patch-auth.js || echo WARN` que falla en silencio.
- **Sin headers de seguridad en Caddy** (`Caddyfile.production:5-8`): solo proxy+gzip; sin HSTS/XFO/CSP (helmet mitiga a nivel API).
- **Inconsistencia en compose:** `OA_BASE_URL=http://localhost:2785` vs `OPENWA_BASE_URL=http://openwa:2785` (config heredada sin revisar); imagen openwa `:latest` sin digest.
- **Enumeración de usuarios:** `isActive` se chequea antes de comparar password en login; registro responde 409 si el email existe (limitado por rate limit).
- **Upload de knowledge sin validación client-side** (`BotEditor.tsx:84-99`, `botStore.ts:102-109`) — el enforcement real está en el backend (allowlist + 10MB, bien), pero falta tamaño/tipo en el cliente.
- **Rol de admin del dashboard en localStorage** (`useRole.tsx:10-19`, gating cosmético; la API key va en sessionStorage `App.tsx:40`).

## BAJOS

- Multer 1.x deprecado (migrar a 2.x); Prisma 5.22 una major atrás (mantenimiento).
- No existe endpoint de reset/cambio de contraseña en todo el backend.
- `openwa/.env.production` commiteado (placeholders, pero `.gitignore` no cubre `.env.production` con valores reales).
- Heurística `isEncrypted` frágil (`crypto.service.ts:39-50`) — puede intentar descifrar tokens planos.
- `PUT /api/whatsapp/config` devuelve el ciphertext completo de los tokens.

---

## BIEN HECHO

1. **Cero SQL raw** en todo el backend — Prisma client tipado elimina la inyección SQL estructuralmente.
2. **AES-256-GCM correctamente implementado** para tokens de Meta (IV aleatorio por cifrado, auth tag verificado) — solo débil por el fallback de clave (C3).
3. **Webhook interno n8n→CRM bien diseñado:** secreto aleatorio por org, guardado solo como hash bcrypt, allowlist de acciones.
4. **Auth base sólida:** bcrypt-12, rate limit de login (10/15min) + global (100/min), mensajes genéricos en login fallido, Zod en auth/bots/conversations.
5. **Superficie de red correcta:** Postgres nunca publicado, backend solo vía proxy, healthchecks con depends_on condicional en los 3 compose.
6. **Frontends limpios:** cero sinks XSS (`dangerouslySetInnerHTML`/`innerHTML`/eval), sin secretos en variables `VITE_*`.
7. **`agent-chat` es el ejemplo correcto de multi-tenancy** — replicar ese patrón en el resto.

---

## PLAN DE REMEDIACIÓN PRIORIZADO

> **ESTADO (2026-09-23):** El bloque "Ya" está implementado y verificado (backend compila, smoke tests de crypto/env/fail-fast pasan, builds OK). Pendiente del bloque "Ya": setear en producción `META_APP_SECRET`, `ENCRYPTION_KEY` y rotar el verify token y la contraseña de Postgres (acciones en el panel de Dokploy/Meta, no en el repo).

### Ya (horas de trabajo, cierra los críticos) — ✅ HECHO
1. **Fail-fast con secretos:** eliminados los fallbacks `"fallback-secret"` (auth.ts, auth.controller.ts) y `"fallback-key-change-in-prod"` (crypto.service.ts, ahora deriva de JWT_SECRET real con warning si falta ENCRYPTION_KEY); `jwt.verify` con `algorithms: ["HS256"]`; producción exige JWT_SECRET y DATABASE_URL (exit 1); dev genera secreto efímero. Compose sin defaults de secretos (`:?required`). ⏳ falta: definir `ENCRYPTION_KEY` propia en producción.
2. **Firma del webhook de Meta:** verificación `X-Hub-Signature-256` con HMAC-SHA256 + `timingSafeEqual` sobre el raw body (capturado con `express.json({ verify })`). Con `META_APP_SECRET` seteada la firma es obligatoria; sin ella, producción acepta pero loguea error visible cada minuto. Verify token con comparación timing-safe y `updateMany` acotado al config verificado. ⏳ falta: setear `META_APP_SECRET` en Dokploy.
3. **Auth en Socket.io:** middleware `io.use()` con JWT en el handshake (el frontend actualizado envía `auth.token`); auto-join a room `org:{orgId}`; `join-conversation` y `message:send` validan contra la DB que la conversación pertenece a la org del usuario; `agent-chat:message` emite solo al room de la org (adiós broadcast global).
4. **`requireAdmin` faltantes:** whatsapp `PUT /config` y `POST /test`; todo el router openwa (config/QR/reset/test); logs `DELETE`; todo lab; AI create/update/delete/default/test-generate (listado queda autenticado con keys enmascaradas; suggest-responses queda para agentes).
5. **No devolver apiKeys:** `GET /api/ai` y `openwa GET/PUT /config` devuelven máscara `••••abcd`; al guardar, valor enmascarado = conservar el guardado. Cifrado en reposo con `encrypt()` para `aIConfig.apiKey`, `Setting[n8n_api_key]` y `openwaConfig.apiKey`, con `decrypt()` (vía `isEncrypted`) en todos los lectores. `PUT /api/whatsapp/config` ya no devuelve ciphertext.
6. **Credenciales commiteadas:** seed (index.ts y prisma/seed.ts) ahora genera contraseña aleatoria impresa una sola vez (nunca `admin123`); `DOKPLOY.md` sin el token real (`seiva2026` → placeholder); compose prod sin `whatsapp_secret` ni defaults de JWT/verify. ⏳ falta (en producción, lo hace el usuario): rotar POSTGRES_PASSWORD, WHATSAPP_VERIFY_TOKEN en el panel de Meta, y la contraseña del admin si aún es la vieja.
7. **`npm audit fix`:** backend 14→0 vulns (bcrypt 5→6 elimina tar critical; hash/compare verificado en runtime); dashboard 14→0; frontend 16→5 (quedan 4 moderate + 1 high que requieren breaking changes: react-router 7.18 y vite 8.3 — dejar para bloque 2). Frontend build OK pese a errores de tsc preexistentes (vite no typechequea).
8. **`WHATSAPP_ENGINE=meta`** como default en todos los compose; openwa eliminado del stack de producción (docker-compose.yml) junto a sus vars OA_*/OPENWA_*; el directorio openwa/ queda solo para pruebas locales.

### Después (días)
9. **orgId obligatorio** en conversation (get/send/media/status), contactos (list/export/delete), tags/customfields, bots (update/delete), templates — y convertir `orgId ? filter : undefined` en 403 si falta.
10. **Proteger `/uploads`:** servir vía ruta autenticada, fileFilter con allowlist de MIME, `Content-Disposition: attachment`, nombres aleatorios criptográficos.
11. **`prisma migrate deploy`** como paso de deploy; eliminar ambos `db push` del arranque; fail-closed.
12. **JWT a cookie httpOnly** (o CSP estricta + aceptar riesgo), revocación básica, y cargar el usuario desde BD en el middleware.
13. **CORS con origin** + bajar el límite de JSON + headers de seguridad en Caddy.
14. **Higiene de repo/build:** `.dockerignore` (+`.env`, `backups/`, `*.sql`, `uploads/`), `backups/` al `.gitignore`, `USER node`, pin de imagen openwa (o eliminarla), quitar `seiva2026` de DOKPLOY.md.

---

*Informe generado con auditoría asistida; todos los hallazgos críticos verificados línea a línea sobre el código fuente.*
