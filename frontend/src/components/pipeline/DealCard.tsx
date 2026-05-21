import { useState } from "react";
import { DollarSign, Calendar, User, Trash2, Pencil } from "lucide-react";
import { Deal } from "../../store/pipelineStore";

interface DealCardProps {
  deal: Deal;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<string, string> = {
  HIGH: "var(--danger)",
  MEDIUM: "var(--warning)",
  LOW: "var(--info)",
};

const priorityLabels: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export default function DealCard({ deal, onDragStart, onEdit, onDelete }: DealCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderLeft: `3px solid ${priorityColors[deal.priority] || "var(--border-default)"}`,
      }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="text-sm font-medium leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
          {deal.name}
        </h4>
        {isHovered && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }}
              className="p-1 rounded transition-colors hover:text-red-500"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-1.5">
        <DollarSign size={12} style={{ color: "var(--text-tertiary)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          ${deal.value.toLocaleString()} {deal.currency}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
          style={{
            background: priorityColors[deal.priority] + "20",
            color: priorityColors[deal.priority],
          }}
        >
          {priorityLabels[deal.priority]}
        </span>
      </div>

      {deal.contact && (
        <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
          <User size={11} />
          <span className="truncate">{deal.contact.name || deal.contact.phone}</span>
        </div>
      )}

      {deal.expectedCloseDate && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <Calendar size={11} />
          <span>{new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
        </div>
      )}

      {deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {deal.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
