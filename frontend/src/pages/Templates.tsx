import { useState, useEffect } from "react";
import api from "../services/api";
import {
  FileText, Plus, Trash2, RefreshCw, X, AlertTriangle, CheckCircle2,
  Send, Clock, Loader2, Search,
} from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  bodyText: string;
  headerType?: string;
  headerText?: string;
  footerText?: string;
  qualityRating?: string;
  lastQualityUpdate?: string;
  metaTemplateId?: string;
}

const statusVariants: Record<string, "success" | "warning" | "danger" | "default"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  PAUSED: "warning",
  DISABLED: "danger",
};

const qualityColors: Record<string, string> = {
  GREEN: "text-success",
  YELLOW: "text-warning",
  RED: "text-danger",
  UNKNOWN: "text-ink-3",
};

const categories = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utility" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/templates");
      setTemplates(data.templates || []);
    } finally { setLoading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const { data } = await api.post("/api/templates/sync");
      alert(`Sync OK: ${data.created} nuevos, ${data.synced} actualizados`);
      fetchTemplates();
    } catch (err: any) {
      alert("Error syncing: " + (err.response?.data?.error || err.message));
    } finally { setSyncing(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar template?")) return;
    try { await api.delete(`/api/templates/${id}`); fetchTemplates(); } catch {}
  }

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand-soft flex items-center justify-center">
            <FileText size={20} className="text-brand-text" />
          </div>
          <div>
            <h1>Templates de WhatsApp</h1>
            <p>Gestiona los mensajes template aprobados por Meta</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            {syncing ? "Sincronizando..." : "Sync Meta"}
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus size={14} />Nuevo template
          </Button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--text-3)" }} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-[13px]" placeholder="Buscar por nombre..." />
          </div>
          <div className="flex gap-1">
            {["", "APPROVED", "PENDING", "REJECTED"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[11.5px] px-2.5 py-1 rounded-sm transition-colors ${statusFilter === s ? "bg-brand-soft text-brand-text font-medium" : "text-ink-2 hover:bg-atlas-hover"}`}>
                {s || "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-ink-3"><Loader2 className="animate-spin mr-2" size={20} />Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={36} className="mx-auto mb-3 text-ink-3 opacity-50" />
          <p className="text-[14px] font-[650] text-ink tracking-tight">Sin templates</p>
          <p className="text-[12px] text-ink-3 mt-1">Crea uno o sincroniza desde Meta.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-atlas-subtle">
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Categoria</th>
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Calidad</th>
                <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Lenguaje</th>
                <th className="text-right px-4 py-2.5 text-[11px] uppercase tracking-wide text-ink-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-atlas-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-ink-3" />
                      <span className="font-[600] text-ink">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{t.category}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariants[t.status] || "default"}>
                      {t.status === "APPROVED" && <CheckCircle2 size={10} className="mr-1" />}
                      {t.status === "REJECTED" && <X size={10} className="mr-1" />}
                      {t.status === "PENDING" && <Clock size={10} className="mr-1" />}
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {t.qualityRating ? (
                      <span className={`text-[11.5px] font-[600] ${qualityColors[t.qualityRating]}`}>{t.qualityRating}</span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{t.language}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(t.id)} className="text-ink-3 hover:text-danger transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <TemplateForm
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchTemplates(); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "es",
    bodyText: "",
    headerType: "",
    headerText: "",
    footerText: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post("/api/templates", form);
      onSave();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-[15px] font-[650] text-ink tracking-tight">Nuevo template</h3>
          <button onClick={onClose} className="btn-icon !w-7 !h-7"><X size={14} /></button>
        </div>
        <div className="modal-body space-y-3">
          <div className="p-3 rounded-md bg-warn-chip-bg border border-warn-chip-border flex items-start gap-2">
            <AlertTriangle size={14} className="text-warn-chip-text flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-warn-chip-text leading-relaxed">
              Meta revisará y aprobará el template (minutos a 48h). Una vez aprobado aparecera en Sync. Las variables se escriben como <code>{`{{1}}`}</code>, <code>{`{{2}}`}</code>, etc.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-ink-2 mb-1">Nombre (sin espacios)</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/\s/g, "_").toLowerCase() })} placeholder="ej. recordatorio_pago" />
            </div>
            <div>
              <label className="block text-[12px] text-ink-2 mb-1">Categoria</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] text-ink-2 mb-1">Cuerpo del mensaje (usa <code>{`{{1}}`}</code>, <code>{`{{2}}`}</code> para variables)</label>
            <Textarea value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} rows={5} placeholder="Hola {`{{1}}`}, tu pedido esta listo..." />
          </div>
          <div>
            <label className="block text-[12px] text-ink-2 mb-1">Footer (opcional)</label>
            <Input value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} placeholder="Texto pequeno al final" />
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.bodyText || saving}>
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            {saving ? "Creando..." : "Crear (ir a PENDING)"}
          </Button>
        </div>
      </div>
    </div>
  );
}