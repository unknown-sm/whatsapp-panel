import { useState, useEffect } from "react";
import api from "../services/api";
import { Plus, Trash2, Clock, TrendingUp, Bot } from "lucide-react";

interface FollowUpRule {
  id: string;
  botId: string;
  delayHours: number;
  maxAttempts: number;
  message: string;
  isActive: boolean;
}

interface Bot {
  id: string;
  name: string;
}

export default function FollowUp() {
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ botId: "", delayHours: 24, maxAttempts: 3, message: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [rulesRes, botsRes, statsRes] = await Promise.all([
        api.get("/api/followup"),
        api.get("/api/bots"),
        api.get("/api/followup/stats"),
      ]);
      setRules(rulesRes.data.rules);
      setBots(botsRes.data.bots);
      setStats(statsRes.data.stats);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newRule.botId || !newRule.message) return;
    setSaving(true);
    try {
      await api.post("/api/followup", newRule);
      setNewRule({ botId: "", delayHours: 24, maxAttempts: 3, message: "", isActive: true });
      setShowCreate(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: FollowUpRule) {
    await api.put(`/api/followup/${rule.id}`, { isActive: !rule.isActive });
    fetchData();
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar esta regla?")) {
      await api.delete(`/api/followup/${id}`);
      fetchData();
    }
  }

  if (loading) return <div className="p-6 text-[var(--text-tertiary)]">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Seguimiento</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">Re-engagement automatico de contactos inactivos</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nueva Regla
        </button>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.ruleId} className="card">
              <div className="flex items-center gap-3 mb-2">
                <Bot size={20} className="text-[var(--accent)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">{stat.botName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{stat.totalAttempts}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Intentos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--accent)]">{stat.reEngaged}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Re-engaged</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-500">{stat.rate}%</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Tasa</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6 border-accent-600/30">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Nueva regla de seguimiento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Bot</label>
              <select
                value={newRule.botId}
                onChange={(e) => setNewRule({ ...newRule, botId: e.target.value })}
                className="input w-full"
              >
                <option value="">Seleccionar bot...</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Horas de inactividad</label>
              <input
                type="number"
                value={newRule.delayHours}
                onChange={(e) => setNewRule({ ...newRule, delayHours: parseInt(e.target.value) })}
                className="input w-full"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Max intentos</label>
              <input
                type="number"
                value={newRule.maxAttempts}
                onChange={(e) => setNewRule({ ...newRule, maxAttempts: parseInt(e.target.value) })}
                className="input w-full"
                min="1"
                max="5"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Mensaje de seguimiento</label>
              <textarea
                value={newRule.message}
                onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                className="input w-full min-h-[60px]"
                placeholder="Hola, notamos que no respondiste..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={saving || !newRule.botId || !newRule.message} className="btn-primary disabled:opacity-50">
              {saving ? "Guardando..." : "Crear Regla"}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <Clock size={48} className="mx-auto mb-4 text-dark-600" />
          <p className="text-[var(--text-tertiary)]">No hay reglas de seguimiento. ¡Crea la primera!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const bot = bots.find((b) => b.id === rule.botId);
            const stat = stats.find((s) => s.ruleId === rule.id);
            return (
              <div key={rule.id} className={`card ${!rule.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`status-dot ${rule.isActive ? "status-online" : "status-offline"}`} />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{bot?.name || "Bot eliminado"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1"><Clock size={14} /> Cada {rule.delayHours}h</span>
                      <span>Max {rule.maxAttempts} intentos</span>
                      {stat && (
                        <span className="flex items-center gap-1 text-[var(--accent)]">
                          <TrendingUp size={14} /> {stat.rate}% re-engaged
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-2 bg-[var(--bg-elevated)] rounded-lg p-2">{rule.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${rule.isActive ? "bg-accent-600" : "bg-[var(--bg-hover)]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rule.isActive ? "left-5" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
