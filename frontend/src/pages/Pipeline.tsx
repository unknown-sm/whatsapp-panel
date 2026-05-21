import { useState, useEffect } from "react";
import { usePipelineStore, Deal } from "../store/pipelineStore";
import PipelineColumn from "../components/pipeline/PipelineColumn";
import { Plus, Filter, BarChart3, Loader2 } from "lucide-react";

export default function Pipeline() {
  const {
    pipelines,
    deals,
    currentPipeline,
    isLoading,
    stats,
    fetchPipelines,
    fetchDeals,
    moveDeal,
    createDeal,
    updateDeal,
    deleteDeal,
    fetchStats,
  } = usePipelineStore();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealForm, setDealForm] = useState({
    name: "",
    value: "",
    stageId: "",
    pipelineId: "",
    priority: "MEDIUM" as Deal["priority"],
    expectedCloseDate: "",
    tags: "",
    notes: "",
  });

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  useEffect(() => {
    if (selectedPipelineId) {
      fetchDeals({ pipelineId: selectedPipelineId });
      fetchStats(selectedPipelineId);
    }
  }, [selectedPipelineId, fetchDeals, fetchStats]);

  const currentDeals = deals.filter((d) => d.pipelineId === selectedPipelineId);
  const stages = currentPipeline?.stages || pipelines.find((p) => p.id === selectedPipelineId)?.stages || [];

  function handleDragStart(e: React.DragEvent, dealId: string) {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(stageId: string) {
    if (!draggedDealId) return;
    await moveDeal(draggedDealId, stageId);
    setDraggedDealId(null);
  }

  function openCreateDeal(stageId?: string) {
    setEditingDeal(null);
    setDealForm({
      name: "",
      value: "",
      stageId: stageId || stages[0]?.id || "",
      pipelineId: selectedPipelineId,
      priority: "MEDIUM",
      expectedCloseDate: "",
      tags: "",
      notes: "",
    });
    setShowModal(true);
  }

  function openEditDeal(deal: Deal) {
    setEditingDeal(deal);
    setDealForm({
      name: deal.name,
      value: String(deal.value),
      stageId: deal.stageId,
      pipelineId: deal.pipelineId,
      priority: deal.priority,
      expectedCloseDate: deal.expectedCloseDate?.slice(0, 10) || "",
      tags: deal.tags.join(", "),
      notes: deal.notes || "",
    });
    setShowModal(true);
  }

  async function handleSubmitDeal(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: dealForm.name,
      value: parseFloat(dealForm.value) || 0,
      stageId: dealForm.stageId,
      pipelineId: selectedPipelineId,
      priority: dealForm.priority,
      expectedCloseDate: dealForm.expectedCloseDate || undefined,
      tags: dealForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: dealForm.notes || undefined,
    };
    if (editingDeal) {
      await updateDeal(editingDeal.id, data);
    } else {
      await createDeal(data);
    }
    setShowModal(false);
    setEditingDeal(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Pipeline de Ventas</h1>
          <p style={{ color: "var(--text-tertiary)" }}>Gestiona tus oportunidades de venta</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline selector */}
          <select
            value={selectedPipelineId}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="input py-1.5 text-sm"
            style={{ width: "200px" }}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={() => openCreateDeal()} className="btn-primary">
            <Plus size={18} /> Nuevo Deal
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Valor Total", value: `$${stats.totalValue.toLocaleString()}`, icon: BarChart3 },
            { label: "Deals", value: stats.totalDeals, icon: Filter },
            { label: "Ganados", value: `$${stats.wonValue.toLocaleString()}`, icon: BarChart3 },
            { label: "Conversion", value: `${stats.conversionRate}%`, icon: BarChart3 },
          ].map((stat) => (
            <div key={stat.label} className="card p-3" style={{ border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={16} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin mr-2" style={{ color: "var(--text-tertiary)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Cargando...</span>
        </div>
      ) : stages.length === 0 ? (
        <div className="card p-8 text-center" style={{ border: "1px solid var(--border-default)" }}>
          <p style={{ color: "var(--text-secondary)" }}>Este pipeline no tiene etapas.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "400px" }}>
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              deals={currentDeals.filter((d) => d.stageId === stage.id)}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onEditDeal={openEditDeal}
              onDeleteDeal={deleteDeal}
              onAddDeal={openCreateDeal}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              {editingDeal ? "Editar Deal" : "Nuevo Deal"}
            </h2>
            <form onSubmit={handleSubmitDeal} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                <input
                  type="text"
                  value={dealForm.name}
                  onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                  className="input"
                  placeholder="Nombre del deal"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Valor</label>
                  <input
                    type="number"
                    value={dealForm.value}
                    onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
                    className="input"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Etapa</label>
                  <select
                    value={dealForm.stageId}
                    onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })}
                    className="input"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Prioridad</label>
                  <select
                    value={dealForm.priority}
                    onChange={(e) => setDealForm({ ...dealForm, priority: e.target.value as Deal["priority"] })}
                    className="input"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Cierre esperado</label>
                  <input
                    type="date"
                    value={dealForm.expectedCloseDate}
                    onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tags (separados por coma)</label>
                <input
                  type="text"
                  value={dealForm.tags}
                  onChange={(e) => setDealForm({ ...dealForm, tags: e.target.value })}
                  className="input"
                  placeholder="tag1, tag2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notas</label>
                <textarea
                  value={dealForm.notes}
                  onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                  className="input resize-none"
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingDeal(null); }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingDeal ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
