import { useState, useEffect } from "react";
import { useLeadScoreStore } from "../store/leadScoreStore";
import { Trophy, Plus, Trash2, Pencil, RefreshCw, Loader2, Zap, MessageSquare, Tag, CheckCircle, Target } from "lucide-react";

const conditionLabels: Record<string, { label: string; icon: typeof Zap }> = {
  MESSAGE_RECEIVED: { label: "Mensaje recibido", icon: MessageSquare },
  MESSAGE_SENT: { label: "Mensaje enviado", icon: MessageSquare },
  KEYWORD_MATCHED: { label: "Keyword coincidente", icon: Target },
  TAG_ADDED: { label: "Tag agregado", icon: Tag },
  CONVERSATION_CLOSED: { label: "Conversacion cerrada", icon: CheckCircle },
  FOLLOW_UP_REPLIED: { label: "Seguimiento respondido", icon: MessageSquare },
  DEAL_CREATED: { label: "Deal creado", icon: Target },
  DEAL_WON: { label: "Deal ganado", icon: Trophy },
};

export default function LeadScoring() {
  const {
    rules,
    leaderboard,
    isLoading,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    fetchLeaderboard,
    recalculate,
  } = useLeadScoreStore();

  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    condition: "MESSAGE_RECEIVED",
    points: "10",
    isActive: true,
  });

  useEffect(() => {
    fetchRules();
    fetchLeaderboard();
  }, [fetchRules, fetchLeaderboard]);

  function openCreateRule() {
    setEditingRule(null);
    setRuleForm({ name: "", condition: "MESSAGE_RECEIVED", points: "10", isActive: true });
    setShowModal(true);
  }

  function openEditRule(rule: any) {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      condition: rule.condition,
      points: String(rule.points),
      isActive: rule.isActive,
    });
    setShowModal(true);
  }

  async function handleSubmitRule(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: ruleForm.name,
      condition: ruleForm.condition,
      points: parseInt(ruleForm.points) || 0,
      isActive: ruleForm.isActive,
    };
    if (editingRule) {
      await updateRule(editingRule.id, data);
    } else {
      await createRule(data);
    }
    setShowModal(false);
    setEditingRule(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Lead Scoring</h1>
          <p style={{ color: "var(--text-tertiary)" }}>Puntuacion automatica de contactos</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => recalculate()} className="btn-secondary" disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Recalcular
          </button>
          <button onClick={openCreateRule} className="btn-primary">
            <Plus size={18} /> Nueva Regla
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card mb-6 p-5" style={{ border: "1px solid var(--border-default)" }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Trophy size={20} style={{ color: "var(--warning)" }} /> Top Leads
        </h2>
        {isLoading && leaderboard.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin mr-2" style={{ color: "var(--text-tertiary)" }} />
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "var(--text-tertiary)" }}>No hay puntuaciones aun</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--text-tertiary)" }}>#</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--text-tertiary)" }}>Contacto</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--text-tertiary)" }}>Puntos</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--text-tertiary)" }}>Actividades</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr
                    key={entry.contactId}
                    className="transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <td className="py-2.5 px-3 font-medium" style={{ color: "var(--text-secondary)" }}>
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {entry.contact?.name || "Sin nombre"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{entry.contact?.phone}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold" style={{ color: "var(--accent)" }}>
                        {entry.totalPoints}
                      </span>
                    </td>
                    <td className="py-2.5 px-3" style={{ color: "var(--text-secondary)" }}>
                      {entry.activityCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rules config */}
      <div className="card p-5" style={{ border: "1px solid var(--border-default)" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Reglas de Puntuacion</h2>
        {rules.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "var(--text-tertiary)" }}>No hay reglas configuradas</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const cond = conditionLabels[rule.condition] || { label: rule.condition, icon: Zap };
              const Icon = cond.icon;
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-lg transition-colors"
                  style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-hover)" }}>
                      <Icon size={16} style={{ color: "var(--text-secondary)" }} />
                    </div>
                    <div>
                      <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{rule.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {cond.label} • {rule.points} pts
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.isActive ? "badge-success" : "badge"}`}
                    >
                      {rule.isActive ? "Activa" : "Inactiva"}
                    </span>
                    <button
                      onClick={() => openEditRule(rule)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 rounded transition-colors hover:text-red-500"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              {editingRule ? "Editar Regla" : "Nueva Regla"}
            </h2>
            <form onSubmit={handleSubmitRule} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="input"
                  placeholder="Ej: Mensaje recibido"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Condicion</label>
                <select
                  value={ruleForm.condition}
                  onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })}
                  className="input"
                >
                  {Object.entries(conditionLabels).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Puntos</label>
                <input
                  type="number"
                  value={ruleForm.points}
                  onChange={(e) => setRuleForm({ ...ruleForm, points: e.target.value })}
                  className="input"
                  min="1"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={ruleForm.isActive}
                  onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm" style={{ color: "var(--text-secondary)" }}>Activa</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">{editingRule ? "Guardar" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
