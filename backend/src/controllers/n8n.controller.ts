import { Request, Response } from "express";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const N8N_API_URL = process.env.N8N_API_URL || "https://n8n.seiva.com.py";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

export async function importWorkflows(req: Request, res: Response) {
  try {
    if (!N8N_API_KEY) {
      return res.status(400).json({ error: "N8N_API_KEY no configurada" });
    }

    const workflowsDir = path.join(__dirname, "../../n8n/workflows");
    const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".json"));

    const results: any[] = [];

    // Listar workflows existentes en n8n
    const existing = await axios.get(`${N8N_API_URL}/api/v1/workflows`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY },
    });
    const existingNames = new Set((existing.data.data || []).map((w: any) => w.name));

    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), "utf-8"));
      if (existingNames.has(content.name)) {
        results.push({ file, status: "skipped", reason: "ya existe" });
        continue;
      }
      const created = await axios.post(`${N8N_API_URL}/api/v1/workflows`, content, {
        headers: {
          "X-N8N-API-KEY": N8N_API_KEY,
          "Content-Type": "application/json",
        },
      });
      results.push({ file, status: "imported", id: created.data.id, name: content.name });
    }

    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message, data: err.response?.data });
  }
}

export async function listN8nWorkflows(req: Request, res: Response) {
  try {
    if (!N8N_API_KEY) {
      return res.status(400).json({ error: "N8N_API_KEY no configurada" });
    }
    const r = await axios.get(`${N8N_API_URL}/api/v1/workflows`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY },
    });
    res.json(r.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
