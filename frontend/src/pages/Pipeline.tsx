import { useState, useEffect, useMemo } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { usePipelineStore, Deal } from "../store/pipelineStore";
import {
  Plus, Filter, BarChart3, Loader2, Trophy, XCircle, GripVertical,
  DollarSign, Calendar, Tag as TagIcon, AlertCircle,
} from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

export default function Pipeline() {
  const {
    pipelines, deals, currentPipeline, isLoading, stats,
    fetchPipelines, fetchDeals, moveDeal, createDeal, updateDeal, deleteDeal, fetchStats,
  } = usePipelineStore();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealForm, setDealForm] = useState({
    name: "", value: "", stageId: "", pipelineId: "",
    priority: "MEDIUM" as Deal["priority"], expectedCloseDate: "", tags: "", notes: "",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      const def = pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(def.id);
    }
  }, [pipelines, selectedPipelineId]);
  useEffect(() => {
    if (selectedPipelineId) {
      fetchDeals({ pipelineId: selectedPipelineId });
      fetchStats(selectedPipelineId);
    }
  }, [selectedPipelineId, fetchDeals, fetchStats]);

  const stages = useMemo(() => {
    const p = pipelines.find((p) => p.id === selectedPipelineId);
    return p?.stages?.sort((a, b) => a.order - b.order) || [];
  }, [pipelines, selectedPipelineId]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of stages) map[stage.id] = [];
    for (const deal of deals) {
      if (map[deal.stageId]) map[deal.stageId].push(deal);
    }
    return map;
  }, [deals, stages]);

  const activeDeal = activeDealId ? deals.find((d) => d.id === activeDealId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveDealId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDealId(null);
    if (!e.over) return;
    const dealId = String(e.active.id);
    const newStageId = String(e.over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stageId !== newStageId) {
      const stage = stages.find((s) => s.id === newStageId);
      if (stage?.kind === "won" || stage?.kind === "lost") {
        if (!confirm(`Mover a "${stage.name}"?`)) return;
      }
      moveDeal(dealId, newStageId);
    }
  }

  function openCreateModal(stageId?: string) {
    setEditingDeal(null);
    setDealForm({
      name: "", value: "", stageId: stageId || stages[0]?.id || "",
      pipelineId: selectedPipelineId, priority: "MEDIUM",
      expectedCloseDate: "", tags: "", notes: "",
    });
    setShowModal(true);
  }

  function openEditModal(deal: Deal) {
    setEditingDeal(deal);
    setDealForm({
      name: deal.name, value: String(deal.value || ""),
      stageId: deal.stageId, pipelineId: deal.pipelineId,
      priority: deal.priority,
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split("T")[0] : "",
      tags: (deal.tags || []).join(", "),
      notes: deal.notes || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    const payload = {
      name: dealForm.name,
      value: parseFloat(dealForm.value) || 0,
      stageId: dealForm.stageId,
      pipelineId: dealForm.pipelineId,
      priority: dealForm.priority,
      expectedCloseDate: dealForm.expectedCloseDate ? new Date(dealForm.expectedCloseDate) : null,
      tags: dealForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: dealForm.notes,
    };
    if (editingDeal) await updateDeal(editingDeal.id, payload);
    else await createDeal(payload);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (confirm("Eliminar deal?")) await deleteDeal(id);
  }

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pipeline de Ventas</h1>
          <p>Gestiona las oportunidades del funnel comercial</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedPipelineId} onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="text-[13px] py-1.5 px-3 rounded-md border border-border bg-background text-ink">
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button variant="outline" size="sm"><Filter size={14} />Filtros</Button>
          <Button onClick={() => openCreateModal()} size="sm"><Plus size={14} />Nuevo deal</Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total deals", value: stats.totalDeals, icon: BarChart3 },
            { label: "Open", value: stats.openDeals, icon: AlertCircle },
            { label: "Won", value: stats.wonDeals, icon: Trophy },
            { label: "Revenue", value: `$${(stats.totalValue || 0).toLocaleString()}`, icon: DollarSign },
          ].map((s, i) => (
            <div key={i} className="card flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-atlas-panel flex items-center justify-center">
                <s.icon size={16} className="text-ink-2" />
              </div>
              <div>
                <p className="text-[18px] font-[650] text-ink tracking-tight leading-none">{s.value}</p>
                <p className="text-[11px] text-ink-3 uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && !deals.length ? (
        <div className="flex items-center justify-center py-12 text-ink-3"><Loader2 className="animate-spin mr-2" size={20} />Cargando...</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: "60vh" }}>
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onAddDeal={() => openCreateModal(stage.id)}
                onEditDeal={openEditModal}
                onDeleteDeal={handleDelete}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-[15px] font-[650] text-ink tracking-tight">{editingDeal ? "Editar deal" : "Nuevo deal"}</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon !w-7 !h-7"><XCircle size={14} /></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Nombre</label>
                <input value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} className="input" placeholder="Ej. Licencia Empresa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-ink-2 mb-1">Valor (USD)</label>
                  <input type="number" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} className="input" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[12px] text-ink-2 mb-1">Prioridad</label>
                  <select value={dealForm.priority} onChange={(e) => setDealForm({ ...dealForm, priority: e.target.value as Deal["priority"] })} className="input">
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Etapa</label>
                <select value={dealForm.stageId} onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })} className="input">
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Fecha esperada de cierre</label>
                <input type="date" value={dealForm.expectedCloseDate} onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Tags (separados por coma)</label>
                <input value={dealForm.tags} onChange={(e) => setDealForm({ ...dealForm, tags: e.target.value })} className="input" placeholder="vip, urgente" />
              </div>
              <div>
                <label className="block text-[12px] text-ink-2 mb-1">Notas</label>
                <textarea value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} className="input min-h-[80px]" />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!dealForm.name}>{editingDeal ? "Guardar" : "Crear"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stage Column ─────────────────────────────────────── */

function StageColumn({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: {
  stage: { id: string; name: string; color: string; kind?: string };
  deals: Deal[];
  onAddDeal: () => void;
  onEditDeal: (d: Deal) => void;
  onDeleteDeal: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const isWon = stage.kind === "won";
  const isLost = stage.kind === "lost";
  const stageValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const Icon = isWon ? Trophy : isLost ? XCircle : null;

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 flex flex-col rounded-lg border ${isOver ? "border-brand bg-brand-tint" : "border-border"} bg-atlas-subtle transition-colors`}
      style={{ minHeight: "60vh" }}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color || "var(--text-3)" }} />
          {Icon && <Icon size={13} className={isWon ? "text-success" : "text-danger"} />}
          <h3 className="text-[12.5px] font-[650] text-ink tracking-tight truncate">{stage.name}</h3>
          <Badge variant="default">{deals.length}</Badge>
        </div>
        <button onClick={onAddDeal} className="btn-icon !w-6 !h-6" title="Agregar deal"><Plus size={12} /></button>
      </div>
      {stageValue > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-ink-3 border-b border-border">
          ${stageValue.toLocaleString()}
        </div>
      )}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {deals.map((deal) => (
          <DraggableDealCard key={deal.id} deal={deal} onEdit={() => onEditDeal(deal)} onDelete={() => onDeleteDeal(deal.id)} />
        ))}
        {deals.length === 0 && (
          <div className="py-8 text-center text-[11.5px] text-ink-3">
            Arrastra deals aqui
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Draggable Deal Card ──────────────────────────────── */

function DraggableDealCard({ deal, onEdit, onDelete }: { deal: Deal; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <DealCard deal={deal} dragHandle={{ ...attributes, ...listeners }} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function DealCard({ deal, isDragging, dragHandle, onEdit, onDelete }: {
  deal: Deal;
  isDragging?: boolean;
  dragHandle?: any;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const priorityColors = { LOW: "var(--text-3)", MEDIUM: "var(--info)", HIGH: "var(--warning)" };
  return (
    <div
      className={`bg-background border border-border rounded-md p-2.5 cursor-pointer hover:border-border-strong transition-all ${isDragging ? "rotate-2 shadow-pop" : ""}`}
      style={{ borderLeft: `3px solid ${priorityColors[deal.priority]}` }}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-[13px] font-[600] text-ink leading-tight flex-1 pr-1">{deal.name}</p>
        {dragHandle && (
          <button {...dragHandle} className="text-ink-3 hover:text-ink-2 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
            <GripVertical size={12} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-ink-3">
        <span className="font-[600] text-ink">${(deal.value || 0).toLocaleString()}</span>
        {deal.expectedCloseDate && (
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(deal.expectedCloseDate).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {deal.tags.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-atlas-panel text-ink-2">{t}</span>
          ))}
        </div>
      )}
      {deal.contactId && (
        <div className="mt-1.5 pt-1.5 border-t border-border">
          <p className="text-[10.5px] text-ink-3 truncate">{deal.contactId}</p>
        </div>
      )}
    </div>
  );
}