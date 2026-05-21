import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBotStore } from "../store/botStore";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";

export default function BotGrid() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
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
      await createBot({ name: newName.trim(), keywords });
      setNewName("");
      setNewKeywords("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(bot: any) {
    await updateBot(bot.id, { isActive: !bot.isActive });
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar este bot?")) await deleteBot(id);
  }

  async function handleAddKeyword(botId: string, keyword: string) {
    if (!keyword.trim()) return;
    await addKeyword(botId, keyword.trim());
  }

  async function handleRemoveKeyword(botId: string, keywordId: string) {
    await removeKeyword(botId, keywordId);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Bots</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">{bots.length} bot{bots.length !== 1 ? "s" : ""} configurado{bots.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nuevo Bot
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o keyword..."
          className="input w-full pl-10"
        />
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6 border-accent-600/30">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Crear nuevo bot</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre del bot</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input w-full" placeholder="ej: Promo Oregano" />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Keywords (separadas por coma)</label>
              <input type="text" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} className="input w-full" placeholder="ej: promo, oferta, descuento" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary disabled:opacity-50">
                {creating ? "Creando..." : "Crear Bot"}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bot grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">Cargando bots...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-tertiary)]">{search ? "No se encontraron bots" : "No hay bots creados. ¡Crea el primero!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bot) => (
            <div key={bot.id} className={`card ${!bot.isActive ? "opacity-60" : ""}`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] truncate">{bot.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`status-dot ${bot.isActive ? "status-online" : "status-offline"}`} />
                    <span className="text-xs text-[var(--text-tertiary)]">{bot.isActive ? "En línea" : "Fuera de línea"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/bots/${bot.id}`)} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(bot.id)} className="p-1.5 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {bot.keywords.map((kw) => (
                  <span key={kw.id} className="pill">
                    {kw.keyword}
                    <button onClick={() => handleRemoveKeyword(bot.id, kw.id)} className="pill-remove ml-1">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {bot.keywords.length === 0 && <span className="text-xs text-[var(--text-tertiary)]">Sin keywords</span>}
              </div>

              {/* Exact match toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--text-tertiary)]">Coincidencia exacta</span>
                <button
                  onClick={() => handleToggle({ ...bot, exactMatch: !bot.exactMatch })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${bot.exactMatch ? "bg-accent-600" : "bg-[var(--bg-hover)]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${bot.exactMatch ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] pt-3 border-t border-[var(--border-default)]">
                <span>{bot._count?.flowSteps || 0} pasos</span>
                <span>{bot._count?.conversations || 0} conversaciones</span>
              </div>

              {/* Add keyword inline */}
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