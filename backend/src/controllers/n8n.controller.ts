import { Request, Response } from "express";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const N8N_API_URL = process.env.N8N_API_URL || "https://n8n.seiva.com.py";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

const headers = () => ({
  "X-N8N-API-KEY": N8N_API_KEY,
  "Content-Type": "application/json",
});

async function createCredential(credential: any) {
  return axios.post(`${N8N_API_URL}/api/v1/credentials`, credential, { headers: headers() });
}

async function listWorkflows() {
  const r = await axios.get(`${N8N_API_URL}/api/v1/workflows`, { headers: headers() });
  return r.data.data || [];
}

async function createOrUpdateWorkflow(workflow: any) {
  const existing = await listWorkflows();
  const found = existing.find((w: any) => w.name === workflow.name);
  if (found) {
    await axios.put(`${N8N_API_URL}/api/v1/workflows/${found.id}`, workflow, { headers: headers() });
    return { id: found.id, status: "updated" };
  } else {
    const r = await axios.post(`${N8N_API_URL}/api/v1/workflows`, workflow, { headers: headers() });
    return { id: r.data.id, status: "created" };
  }
}

async function activateWorkflow(id: string) {
  await axios.post(`${N8N_API_URL}/api/v1/workflows/${id}/activate`, null, { headers: headers() });
}

// Workflow definitions hardcoded para no depender de archivos
const dealWonNpsWorkflow = {
  name: "CRM: Deal Won → NPS + Notificación",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "crm-deal-won",
        responseMode: "responseNode",
        options: {},
      },
      id: "webhook-trigger",
      name: "Webhook (Deal Won)",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
    },
    {
      parameters: {
        jsCode: `const event = $input.first().json;
return {
  json: {
    eventType: event.type,
    contactId: event.data?.contactId,
    contactName: event.data?.contactName,
    contactPhone: event.data?.contactPhone,
    dealId: event.data?.dealId,
    dealName: event.data?.dealName,
    dealValue: event.data?.dealValue,
    agentId: event.data?.agentId,
    orgId: event.orgId,
    sendAt: new Date(Date.now() + 86400000).toISOString(),
  }
};`,
      },
      id: "transform",
      name: "Transformar evento",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [450, 300],
    },
    {
      parameters: { amount: 24, unit: "hours" },
      id: "wait-24h",
      name: "Esperar 24h",
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [650, 300],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $env.CRM_API_URL }}/api/nps/send",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" },
            { name: "Authorization", value: "=Bearer {{ $env.CRM_API_TOKEN }}" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={\n  "contactId": {{ JSON.stringify($json.contactId) }},\n  "triggerType": "deal_won"\n}`,
        options: {},
      },
      id: "send-nps",
      name: "Enviar NPS al cliente",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [850, 300],
    },
  ],
  connections: {
    "Webhook (Deal Won)": { main: [[{ node: "Transformar evento", type: "main", index: 0 }]] },
    "Transformar evento": { main: [[{ node: "Esperar 24h", type: "main", index: 0 }]] },
    "Esperar 24h": { main: [[{ node: "Enviar NPS al cliente", type: "main", index: 0 }]] },
  },
  settings: { saveManualExecutions: true, executionOrder: "v1" },
};

// Workflow universal que recibe TODOS los eventos
const crmEventRouter = {
  name: "CRM: Router de eventos",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "crm-events",
        responseMode: "responseNode",
        options: {},
      },
      id: "webhook-router",
      name: "Webhook (Todos los eventos)",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
          conditions: [
            { id: "1", leftValue: "={{ $json.body.type }}", rightValue: "deal.won", operator: { type: "string", operation: "equals" } },
          ],
          combinator: "or",
        },
      },
      id: "if-deal-won",
      name: "Si deal.won",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [450, 300],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $env.N8N_API_URL }}/webhook-test/crm-deal-won",
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "Content-Type", value: "application/json" }],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.body) }}",
        options: {},
      },
      id: "forward-deal-won",
      name: "Forward a deal-won workflow",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [700, 200],
    },
  ],
  connections: {
    "Webhook (Todos los eventos)": {
      main: [[{ node: "Si deal.won", type: "main", index: 0 }]],
    },
    "Si deal.won": {
      main: [[{ node: "Forward a deal-won workflow", type: "main", index: 0 }]],
    },
  },
  settings: { saveManualExecutions: true, executionOrder: "v1" },
};

export async function setupEverything(req: Request, res: Response) {
  try {
    if (!N8N_API_KEY) {
      return res.status(400).json({ error: "N8N_API_KEY no configurada" });
    }

    const results: any = { steps: [] };

    // 1. Crear credencial para el CRM
    try {
      await createCredential({
        name: "CRM Seiva API",
        type: "httpHeaderAuth",
        data: {
          name: "Authorization",
          value: `Bearer ${process.env.CRM_ADMIN_TOKEN || ""}`,
        },
      });
      results.steps.push({ step: "create_crm_credential", status: "ok" });
    } catch (err: any) {
      // puede que ya exista
      results.steps.push({ step: "create_crm_credential", status: err.response?.status === 409 ? "exists" : "error", error: err.message });
    }

    // 2. Crear/actualizar workflow de deal-won
    const dealWon = await createOrUpdateWorkflow(dealWonNpsWorkflow);
    await activateWorkflow(dealWon.id);
    results.steps.push({ step: "deal_won_workflow", status: "ok", ...dealWon });

    // 3. Crear/actualizar router universal
    const router = await createOrUpdateWorkflow(crmEventRouter);
    await activateWorkflow(router.id);
    results.steps.push({ step: "event_router", status: "ok", ...router });

    // 4. Configurar variable de entorno en n8n
    try {
      await axios.post(
        `${N8N_API_URL}/api/v1/variables`,
        { key: "CRM_API_URL", value: process.env.CRM_API_URL || "https://crm.seiva.com.py" },
        { headers: headers() }
      );
      await axios.post(
        `${N8N_API_URL}/api/v1/variables`,
        { key: "CRM_API_TOKEN", value: process.env.CRM_ADMIN_TOKEN || "" },
        { headers: headers() }
      );
      results.steps.push({ step: "set_n8n_variables", status: "ok" });
    } catch (err: any) {
      results.steps.push({ step: "set_n8n_variables", status: "error", error: err.message });
    }

    res.json({ ok: true, ...results });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: err.response?.data });
  }
}

export async function importWorkflows(req: Request, res: Response) {
  try {
    if (!N8N_API_KEY) {
      return res.status(400).json({ error: "N8N_API_KEY no configurada" });
    }

    const workflowsDir = path.join(__dirname, "../../n8n/workflows");
    const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".json"));

    const results: any[] = [];
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), "utf-8"));
      try {
        const r = await createOrUpdateWorkflow(content);
        await activateWorkflow(r.id);
        results.push({ file, status: r.status, id: r.id });
      } catch (err: any) {
        results.push({ file, status: "error", error: err.message });
      }
    }

    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listN8nWorkflows(req: Request, res: Response) {
  try {
    if (!N8N_API_KEY) {
      return res.status(400).json({ error: "N8N_API_KEY no configurada" });
    }
    const r = await axios.get(`${N8N_API_URL}/api/v1/workflows`, { headers: headers() });
    res.json(r.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
