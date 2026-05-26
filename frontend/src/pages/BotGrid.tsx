import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBotStore } from "../store/botStore";
import { Plus, Search, Pencil, Trash2, X, Bot as BotIcon } from "lucide-react";

export default function BotGrid() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const { bots, isLoading, fetchBots, createBot, deleteBot, updateBot, addKeyword, removeKeyword } = useBotStore();
  const navigate = useNavigate();

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const filtered = bots.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.keywords.some((k) => k.keyword.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
      await createBot({ name: newName.trim(), keywords, systemPrompt: newSystemPrompt.trim() || undefined });
      setNewName("");
      setNewKeywords("");
      setNewSystemPrompt("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(bot: any) {
    await updateBot(bot.id, { isActive: !bot.isActive });
  }

  async function handleDelete(id: string) {
    if (confirm("Eliminar este bot?")) await deleteBot(id);
  }

  async function handleAddKeyword(botId: string, keyword: string) {
    if (!keyword.trim()) return;
    await addKeyword(botId, keyword.trim());
  }

  async function handleRemoveKeyword(botId: string, keywordId: string) {
    await removeKeyword(botId, keywordId);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bots</h1>
          <p>{bots.length} bot{bots.length !== 1 ? "s" : ""} configurado{bots.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> Nuevo Bot
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--text-tertiary)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o keyword..."
          className="input w-full pl-10"
        />
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Crear nuevo bot</h2>
              <button onClick={() => setShowCreate(false)} className="btn-icon !w-8 !h-8">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre del bot</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" placeholder="ej: Promo Oregano" autoFocus />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Keywords (separadas por coma)</label>
                <input type="text" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} className="input" placeholder="ej: promo, oferta, descuento" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>System Prompt (instrucciones para IA)</label>
                <textarea value={newSystemPrompt} onChange={(e) => setNewSystemPrompt(e.target.value)} className="input resize-none" rows={3} placeholder="Eres un asistente de ventas amable. Responde en espanol..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary disabled:opacity-50">
                {creating ? "Creando..." : "Crear Bot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>Cargando bots...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p style={{ color: "var(--text-tertiary)" }}>{search ? "No se encontraron bots" : "No hay bots creados. Crea el primero!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bot) => (
            <div key={bot.id} className={`card ${!bot.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-muted)" }}>
                    <BotIcon size={20} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{bot.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`status-dot ${bot.isActive ? "status-online" : "status-offline"}`} />
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{bot.isActive ? "Activo" : "Inactivo"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => navigate(`/bots/${bot.id}`)} className="btn-icon !w-8 !h-8" title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(bot.id)} className="btn-icon !w-8 !h-8 hover:!bg-red-500/20 hover:!text-red-400" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {bot.keywords.map((kw) => (
                  <span key={kw.id} className="pill text-xs">
                    {kw.keyword}
                    <button onClick={() => handleRemoveKeyword(bot.id, kw.id)} className="ml-0.5 hover:text-[var(--danger)] transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {bot.keywords.length === 0 && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Sin keywords</span>}
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Coincidencia exacta</span>
                <button
                  onClick={() => handleToggle({ ...bot, exactMatch: !bot.exactMatch })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${bot.exactMatch ? "bg-[var(--accent)]" : "bg-[var(--bg-active)]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${bot.exactMatch ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs pt-3 border-t" style={{ color: "var(--text-tertiary)", borderColor: "var(--border-default)" }}>
                <span>{bot._count?.flowSteps || 0} pasos</span>
                <span>{bot._count?.conversations || 0} conversaciones</span>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Agregar keyword..."
                  className="input flex-1 text-xs py-1.5"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddKeyword(bot.id, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
