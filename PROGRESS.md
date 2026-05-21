# Progreso WhatsApp Panel — COMPLETO

## Estado: Todas las fases implementadas y corriendo

## Completado

### Fase 8: Redesign + Theme Toggle
- Theme store con 3 modos (light/dark/system), deteccion de prefers-color-scheme, persistencia localStorage
- CSS variables para ambos temas (--bg-base, --text-primary, --accent, etc.)
- ThemeToggle componente en header con dropdown sol/luna/monitor
- Todas las paginas migradas de dark-* a variables CSS
- Scrollbar, inputs, botones, cards, badges theme-aware

### Fase 9: Pipeline de Ventas (Kanban)
- Modelos Pipeline, PipelineStage, Deal + enums DealStatus, DealPriority
- CRUD completo backend: pipelines, stages, deals, moveDeal
- Pipeline por defecto "Ventas WhatsApp" con 6 etapas (seed automatico)
- Kanban drag-and-drop nativo con columnas y DealCards
- Stats: valor total, deals, ganados, tasa de conversion
- Modal crear/editar deal con campos: nombre, valor, prioridad, cierre, tags

### Fase 10: Lead Scoring
- Modelos LeadScoreRule, LeadScore + enum ScoreCondition
- 8 condiciones configurables: MESSAGE_RECEIVED, MESSAGE_SENT, KEYWORD_MATCHED, TAG_ADDED, CONVERSATION_CLOSED, FOLLOW_UP_REPLIED, DEAL_CREATED, DEAL_WON
- Leaderboard de contactos ordenado por puntos totales
- Recalculacion automatica de scores basada en reglas
- CRUD de reglas con prioridad, condicion y puntos

### Fase 11: Deals/Revenue widgets
- Endpoint /api/pipeline/revenue/summary con agregaciones
- Widgets de revenue en Dashboard: valor pipeline, deals ganados, abiertos, conversion
- Backend stats por pipeline: totalValue, wonValue, conversionRate

### Fase 12: Broadcast/Campaigns
- Modelos BroadcastTemplate, Broadcast, BroadcastRecipient + enums
- CRUD de plantillas y broadcasts
- Envio masivo via WhatsApp Cloud API a contactos filtrados
- Programacion de broadcasts con cron job (cada minuto)
- Tracking de estado: DRAFT, SCHEDULED, SENDING, SENT, FAILED
- Frontend: lista de broadcasts, crear con plantilla, programar envio

### Fase 13: Analytics Dashboard
- Endpoints: messages-over-time, conversations-by-bot, contact-growth, deal-funnel, top-bots, overview
- Overview stats: contactos, conversaciones, mensajes, bots, deals, conversion
- Graficos CSS: mensajes (barras), crecimiento contactos (barras acumulativas)
- Embudo de ventas con barras horizontales por etapa
- Top bots ranking

### Fase 14: Custom Fields
- Modelos CustomField, CustomFieldValue + enums FieldType, EntityType
- Campos personalizados para CONTACT y DEAL
- Tipos: TEXT, NUMBER, DATE, SELECT, BOOLEAN
- Configuracion en Settings > Campos Personalizados (solo admin)
- CRUD completo de definiciones

## Servidores
- Backend: http://localhost:4000
- Frontend: http://localhost:5173
- Credenciales: admin@whatsapp-panel.com / admin123

## Rutas del sidebar
- Dashboard (/)
- Bots (/bots)
- Conversaciones (/conversations)
- Seguimiento (/followup)
- Pipeline (/pipeline)
- Lead Scoring (/leadscoring)
- Broadcasts (/broadcasts)
- Analytics (/analytics)
- Configuracion (/settings) — WhatsApp, IA, Usuarios, Campos Personalizados
