import { useState, useEffect } from "react";
import api from "../services/api";
import {
  Star, Send, Plus, Trash2, Loader2, TrendingUp, Users,
  Power, PowerOff, Activity, Award,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";

interface Campaign {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  delayHours: number;
  _count: { responses: number };
}

interface NpsStats {
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
  distribution?: Record<number, number>;
}

export default function Nps() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<NpsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", triggerType: "manual", delayHours: 24 });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [campRes, statsRes] = await Promise.all([
        api.get("/api/nps/campaigns"),
        api.get("/api/nps/stats?days=90"),
      ]);
      setCampaigns(campRes.data.campaigns || []);
      setStats(statsRes.data);
    } finally { setLoading(false); }
  }

  async function createCampaign() {
    if (!form.name.trim()) return;
    try {
      await api.post("/api/nps/campaigns", form);
      setShowForm(false);
      setForm({ name: "", triggerType: "manual", delayHours: 24 });
      load();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  }

  async function toggle(id: string, isActive: boolean) {
    try { await api.put(`/api/nps/campaigns/${id}/toggle`, { isActive: !isActive }); load(); } catch {}
  }

  async function deleteCamp(id: string) {
    if (!confirm("Eliminar campana?")) return;
    try { await api.delete(`/api/nps/campaigns/${id}`); load(); } catch {}
  }

  async function sendNow(id: string) {
    setSendingId(id);
    try {
      const { data } = await api.post(`/api/nps/campaigns/${id}/send`);
      alert(`Enviado a ${data.sent} de ${data.total} contactos`);
      load();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally { setSendingId(null); }
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-ink-3"><Loader2 className="animate-spin mr-2" size={20} />Cargando...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-warn-chip-bg border border-warn-chip-border flex items-center justify-center">
            <Star size={20} className="text-warn-chip-text" />
          </div>
          <div>
            <h1>NPS (Net Promoter Score)</h1>
            <p>Encuestas post-venta para medir satisfaccion y promotores</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm"><Plus size={14} />Nueva campana</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-3">NPS Score</p>
              <p className="text-[36px] font-[650] text-ink tracking-tight leading-none mt-1">
                {stats?.npsScore ?? 0}
              </p>
            </div>
            <Award size={28} className="text-warn-chip-text" />
          </div>
          <p className="text-[11px] text-ink-3 mt-2">
            {stats?.npsScore >= 50 ? "Excelente" : stats?.npsScore >= 0 ? "Bueno" : "Necesita mejora"}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-3">Respuestas</p>
              <p className="text-[28px] font-[650] text-ink tracking-tight leading-none mt-1">
                {stats?.totalResponses ?? 0}
              </p>
            </div>
            <Users size={24} className="text-ink-3" />
          </div>
          <div className="flex gap-3 mt-2 text-[10.5px]">
            <span className="text-success">P: {stats?.promoters ?? 0}</span>
            <span className="text-warning">N: {stats?.passives ?? 0}</span>
            <span className="text-danger">D: {stats?.detractors ?? 0}</span>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Distribucion</p>
          </div>
          {stats?.distribution ? (
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: 11 }, (_, i) => {
                const count = stats.distribution![i] || 0;
                const max = Math.max(...Object.values(stats.distribution!));
                const h = max > 0 ? (count / max) * 100 : 0;
                const color = i <= 6 ? "var(--danger)" : i <= 8 ? "var(--warning)" : "var(--success)";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t" style={{ height: `${h}%`, background: color, minHeight: count > 0 ? 2 : 0 }} />
                    <span className="text-[9px] text-ink-3">{i}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-ink-3">Sin datos</p>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h3 className="section-label">Campanas</h3>
          <Badge variant="default">{campaigns.length}</Badge>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-ink-3">
            Sin campanas. Crea una para empezar a medir satisfaccion.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between hover:bg-atlas-hover">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-[600] text-ink">{c.name}</p>
                    {c.isActive ? <Badge variant="success">activa</Badge> : <Badge variant="default">pausada</Badge>}
                  </div>
                  <p className="text-[11px] text-ink-3 mt-0.5">
                    Trigger: {c.triggerType} · {c._count.responses} respuestas
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => sendNow(c.id)} disabled={sendingId === c.id}>
                    {sendingId === c.id ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                  </Button>
                  <button onClick={() => toggle(c.id, c.isActive)} className="btn-icon !w-7 !h-7" title={c.isActive ? "Pausar" : "Activar"}>
                    {c.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                  </button>
                  <button onClick={() => deleteCamp(c.id)} className="btn-icon !w-7 !h-7" title="Eliminar">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-[15px] font-[650] text-ink tracking-tight">Nueva campana NPS</h3>
              <button onClick={() => setShowForm(false)} className="btn-icon !w-7 !h-7"><PowerOff size={14} /></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Nombre</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. NPS Post-Compra" />
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Trigger</label>
                <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })} className="input">
                  <option value="manual">Manual</option>
                  <option value="deal_won">Deal ganado</option>
                  <option value="scheduled">Programado</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Delay (horas)</label>
                <Input type="number" value={form.delayHours} onChange={(e) => setForm({ ...form, delayHours: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createCampaign} disabled={!form.name.trim()}>Crear</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
