// Carga un workflow en n8n via API
const N8N_URL = process.env.N8N_URL || 'https://n8n.seiva.com.py';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const workflow = require('./n8n/workflows/deal-won-nps-notify.json');

fetch(`${N8N_URL}/api/v1/workflows`, {
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(workflow),
})
.then(r => r.json())
.then(data => console.log('OK:', data.name || data.id))
.catch(err => console.error('ERROR:', err.message));
