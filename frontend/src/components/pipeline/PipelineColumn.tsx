import { useState } from "react";
import { Plus } from "lucide-react";
import DealCard from "./DealCard";
import { Deal } from "../../store/pipelineStore";

interface PipelineColumnProps {
  stage: { id: string; name: string; color: string };
  deals: Deal[];
  onDrop: (stageId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (id: string) => void;
  onAddDeal: (stageId: string) => void;
}

export default function PipelineColumn({
  stage,
  deals,
  onDrop,
  onDragOver,
  onDragStart,
  onEditDeal,
  onDeleteDeal,
  onAddDeal,
}: PipelineColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div
      className="flex-shrink-0 w-72 flex flex-col rounded-xl transition-all duration-200"
      style={{
        background: isDragOver ? "var(--accent-muted)" : "var(--bg-muted)",
        border: `1px solid ${isDragOver ? "var(--accent)" : "var(--border-default)"}`,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(stage.id);
      }}
    >
      {/* Header */}
      <div className="p-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: stage.color }}
          />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {stage.name}
          </h3>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
          >
            {deals.length}
          </span>
        </div>
        <button
          onClick={() => onAddDeal(stage.id)}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title="Agregar deal"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Value summary */}
      {totalValue > 0 && (
        <div className="px-3 pb-2 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
          ${totalValue.toLocaleString()}
        </div>
      )}

      {/* Deals list */}
      <div className="flex-1 overflow-y-auto p-2 pt-0 min-h-[100px]">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onDragStart={onDragStart}
            onEdit={onEditDeal}
            onDelete={onDeleteDeal}
          />
        ))}
      </div>
    </div>
  );
}
