# n8n Integration

Workflows de automatización que complementan el CRM. El backend emite eventos y n8n los procesa visualmente.

## Setup

### 1. Crear instancia n8n en Dokploy

- Service: `n8nio/n8n:latest` con Postgres
- Dominio: `n8n.seiva.com.py`
- Port: 5678
- Environment:
  ```
  N8N_HOST=n8n.seiva.com.py
  N8N_PORT=5678
  N8N_PROTOCOL=https
  N8N_WEBHOOK_URL=https://n8n.seiva.com.py/
  GENERIC_TIMEZONE=America/Asuncion
  DB_TYPE=postgresdb
  DB_POSTGRESDB_HOST=postgres
  DB_POSTGRESDB_DATABASE=n8n
  DB_POSTGRESDB_USER=n8n
  DB_POSTGRESDB_PASSWORD=...
  ```

### 2. Configurar API key

En n8n → Settings → API → Create API key:
- Nombre: `whatsapp-crm`
- Copiá el token

### 3. Variables de entorno en el CRM

En Dokploy → servicio `whatsapp-panel`:
```
N8N_WEBHOOK_URL=https://n8n.seiva.com.py/crm-event
N8N_API_KEY=tu_token_de_n8n
```

### 4. Importar workflows

En n8n → Workflows → Import:
- `workflows/deal-won-nps-notify.json` — Deal ganado → NPS 24h después + Slack

## Webhook del CRM

El backend envía eventos a:
```
POST {N8N_WEBHOOK_URL}
Headers: X-N8n-Event: <tipo>
Body: { type, orgId, timestamp, data }
```

### Tipos de eventos

| Evento | Cuándo | Data |
|--------|--------|------|
| `deal.created` | Se crea un deal | dealId, dealName, value, contactId, agentId |
| `deal.won` | Deal movido a WON | dealId, dealName, value, contactId, contactName, contactPhone, agentId |
| `deal.lost` | Deal movido a LOST | dealId, dealName, contactId, contactName, agentId |
| `message.received` | Cliente envía WhatsApp | contactId, contactName, content, agentId |
| `message.sent` | Agente envía WhatsApp | contactId, content, agentId |
| `lead_score.updated` | Score cambia | contactId, newScore, condition |
| `followup.sent` | Follow-up automático | contactId, content, attemptNumber |
| `contact.created` | Nuevo contacto | contactId, name, phone, source |
| `broadcast.completed` | Broadcast terminado | broadcastId, sentCount, failedCount |

## Patrón: Trigger en n8n

Para cada workflow:

1. **Webhook node** (POST, path único, response mode: responseNode)
2. **Transformar evento** (Code node) — extraer data y headers
3. **Lógica de negocio** (IF, Switch, Function nodes)
4. **Acciones externas** (HTTP Request, Email, Slack, etc.)
5. **Esperar** (Wait node) — si hay delay

## Workflows incluidos

| Workflow | Archivo | Función |
|----------|---------|---------|
| Deal Won → NPS | `workflows/deal-won-nps-notify.json` | Espera 24h, envía NPS, notifica Slack |
