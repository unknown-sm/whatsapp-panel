# WhatsApp Panel — Plataforma de Automatizacion con IA

Panel completo de automatizacion de WhatsApp inspirado en BuilderBot Cloud.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS (dark mode)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Real-time:** Socket.io
- **IA:** Configurable (OpenAI, Anthropic, custom endpoints)
- **WhatsApp:** Meta Cloud API

## Inicio Rapido

### 1. Levantar PostgreSQL

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Login

- Email: `admin@whatsapp-panel.com`
- Password: `admin123`

## Funcionalidades Implementadas

### ✅ Fase 1: Setup y Auth
- [x] PostgreSQL + Prisma schema completo (15 tablas)
- [x] JWT auth con roles Admin/Agent
- [x] Login/Register/GetMe endpoints
- [x] Zustand auth store con interceptores

### ✅ Fase 2: Bots y Flow Editor
- [x] Bot Grid con cards, search, create, edit, delete
- [x] Keywords con pills y toggle de coincidencia exacta
- [x] Bot Editor 3-paneles (config, composer, preview WhatsApp)
- [x] 9 tipos de bloques: Texto, IA, HTTP, Intencion, Silenciar, Calendario, Voz, Datos, Reenviar
- [x] Flow steps CRUD con reordenamiento
- [x] Preview en vivo estilo WhatsApp

### ✅ Fase 3: WhatsApp Integration
- [x] Webhook de Meta Cloud API (verify + incoming)
- [x] Envio de mensajes de texto
- [x] Envio de media (imagen, video, documento)
- [x] Procesamiento de mensajes entrantes
- [x] Matching de bots por keywords
- [x] Ejecucion de flujos automaticos

### ✅ Fase 4: Conversaciones + Real-time
- [x] Panel CRM con lista de conversaciones
- [x] Chat en vivo con Socket.io
- [x] Filtros por estado, bot, agente
- [x] Vista de contactos con tags y notas
- [x] Exportar contactos a CSV
- [x] Asignar agente a conversacion
- [x] Cambiar estado de conversacion

### ✅ Fase 5: Follow-up Engine
- [x] Reglas de seguimiento configurables
- [x] Delay en horas, max intentos, mensaje custom
- [x] Cron job cada 5 minutos
- [x] Estadisticas de re-engagement por bot
- [x] Tag automatico "sin respuesta"

### ✅ Fase 6: IA Configurable
- [x] Panel para agregar proveedores (OpenAI, Anthropic, custom)
- [x] Soporte para GPT-4o, Claude Sonnet, etc.
- [x] Generacion de respuestas con IA
- [x] Clasificacion de intenciones (NLP)
- [x] Transcripcion de audio (Whisper)
- [x] Setear default por proveedor

### ✅ Fase 7: Settings
- [x] Configuracion de WhatsApp (Phone ID, Token, Verify Token)
- [x] Test de conexion a WhatsApp
- [x] Gestion de configuraciones de IA
- [x] Gestion de usuarios (Admin only)

## API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Registro
- `GET /api/auth/me` — Usuario actual

### Bots
- `GET /api/bots` — Lista bots
- `POST /api/bots` — Crear bot
- `PUT /api/bots/:id` — Actualizar bot
- `DELETE /api/bots/:id` — Eliminar bot
- `POST /api/bots/:id/keywords` — Agregar keyword
- `DELETE /api/bots/:id/keywords/:kid` — Eliminar keyword

### Flow Steps
- `GET /api/bots/:id/steps` — Pasos del flujo
- `POST /api/bots/:id/steps` — Crear paso
- `PUT /api/bots/:id/steps/:stepId` — Actualizar paso
- `DELETE /api/bots/:id/steps/:stepId` — Eliminar paso
- `POST /api/bots/:id/steps/reorder` — Reordenar

### WhatsApp
- `GET /webhook/verify` — Verificacion Meta
- `POST /webhook/incoming` — Webhook de mensajes
- `GET /api/whatsapp/status` — Estado de conexion
- `POST /api/whatsapp/test` — Probar conexion
- `PUT /api/whatsapp/config` — Configurar WhatsApp

### Conversaciones
- `GET /api/conversations` — Lista conversaciones
- `GET /api/conversations/:id` — Detalle + mensajes
- `POST /api/conversations/:id/messages` — Enviar mensaje
- `PUT /api/conversations/:id/agent` — Asignar agente
- `PUT /api/conversations/:id/status` — Cambiar estado
- `GET /api/conversations/contacts` — Lista contactos
- `GET /api/conversations/contacts/export` — Exportar CSV

### Follow-up
- `GET /api/followup` — Lista reglas
- `POST /api/followup` — Crear regla
- `PUT /api/followup/:id` — Actualizar regla
- `DELETE /api/followup/:id` — Eliminar regla
- `GET /api/followup/stats` — Estadisticas

### IA
- `GET /api/ai` — Lista configs
- `POST /api/ai` — Agregar config
- `PUT /api/ai/:id` — Actualizar config
- `DELETE /api/ai/:id` — Eliminar config
- `PUT /api/ai/:id/default` — Setear default

## Deploy en EasyPanel

1. Subir a GitHub
2. Conectar repo en EasyPanel
3. Configurar variables de entorno
4. Deploy automatico

## Socket.io Events

### Server → Client
- `message:new` — Nuevo mensaje
- `conversation:updated` — Estado de conversacion cambio
- `agent:assigned` — Agente asignado

### Client → Server
- `join-conversation` — Suscribirse a conversacion
- `message:send` — Agente envia mensaje
