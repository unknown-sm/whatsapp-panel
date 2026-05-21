import { useState, useEffect } from "react";
import { useBroadcastStore } from "../store/broadcastStore";
import { Plus, Send, Calendar, Clock, CheckCircle, XCircle, Loader2, Trash2, MessageSquare } from "lucide-react";

const statusLabels: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  DRAFT: { label: "Borrador", color: "var(--text-tertiary)", icon: Clock },
  SCHEDULED: { label: "Programado", color: "var(--info)", icon: Calendar },
  SENDING: { label: "Enviando", color: "var(--warning)", icon: Loader2 },
  SENT: { label: "Enviado", color: "var(--success)", icon: CheckCircle },
  FAILED: { label: "Fallido", color: "var(--danger)", icon: XCircle },
};

export default function Broadcasts() {
  const { broadcasts, templates, isLoading, fetchBroadcasts, fetchTemplates, createBroadcast, sendBroadcast, deleteBroadcast } = useBroadcastStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", scheduledAt: "", useTemplate: "" });

  useEffect(() => {
    fetchBroadcasts();
    fetchTemplates();
  }, [fetchBroadcasts, fetchTemplates]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: any = { name: form.name, content: form.content };
    if (form.scheduledAt) data.scheduledAt = form.scheduledAt;
    if (form.useTemplate) data.templateId = form.useTemplate;
    await createBroadcast(data);
    setShowModal(false);
    setForm({ name: "", content: "", scheduledAt: "", useTemplate: "" });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Broadcasts</h1>
          <p style={{ color: "var(--text-tertiary)" }}>Envios masivos por WhatsApp</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} /> Nuevo Broadcast
        </button>
      </div>

      {isLoading && broadcasts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="card p-8 text-center" style={{ border: "1px solid var(--border-default)" }}>
          <MessageSquare size={32} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
          <p style={{ color: "var(--text-secondary)" }}>No hay broadcasts creados aun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => {
            const st = statusLabels[b.status] || statusLabels.DRAFT;
            const StatusIcon = st.icon;
            return (
              <div key={b.id} className="card p-4" style={{ border: "1px solid var(--border-default)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>{b.name}</h3>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: st.color, background: st.color + "15" }}>
                        <StatusIcon size={12} className={b.status === "SENDING" ? "animate-spin" : ""} />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{b.content}</p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {b.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {new Date(b.scheduledAt).toLocaleString()}
                        </span>
                      )}
                      {b.sentAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle size={12} /> Enviado: {b.sentCount}/{b.totalCount}
                        </span>
                      )}
                      {b.failedCount > 0 && (
                        <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
                          <XCircle size={12} /> Fallidos: {b.failedCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {b.status === "DRAFT" && (
                      <button
                        onClick={() => sendBroadcast(b.id)}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        <Send size={14} /> Enviar
                      </button>
                    )}
                    <button
                      onClick={() => deleteBroadcast(b.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-lg rounded-xl p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>Nuevo Broadcast</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ej: Promocion Abril" required />
              </div>
              {templates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Plantilla (opcional)</label>
                  <select value={form.useTemplate} onChange={(e) => {
                    const tmpl = templates.find((t) => t.id === e.target.value);
                    setForm({ ...form, useTemplate: e.target.value, content: tmpl ? tmpl.content : form.content });
                  }} className="input">
                    <option value="">Sin plantilla</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Mensaje</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input resize-none" rows={4} placeholder="Escribe tu mensaje..." required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Programar envio (opcional)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
