import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "../store/toastStore";

const variantStyles: Record<Toast["variant"], { border: string; icon: any; iconColor: string }> = {
  default: { border: "var(--border)", icon: Info, iconColor: "var(--text-2)" },
  success: { border: "var(--success)", icon: CheckCircle2, iconColor: "var(--success)" },
  error:   { border: "var(--danger)", icon: XCircle, iconColor: "var(--danger)" },
  warning: { border: "var(--warning)", icon: AlertTriangle, iconColor: "var(--warning)" },
  info:    { border: "var(--info)", icon: Info, iconColor: "var(--info)" },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const style = variantStyles[t.variant];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            className="flex items-start gap-2.5 p-3 rounded-md bg-background border bg-popover shadow-pop"
            style={{
              borderColor: style.border,
              borderLeftWidth: 3,
              animation: "slideIn 0.2s ease",
            }}
          >
            <Icon size={15} className="flex-shrink-0 mt-0.5" style={{ color: style.iconColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-[600] text-ink">{t.message}</p>
              {t.description && <p className="text-[11.5px] text-ink-2 mt-0.5 leading-relaxed">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink-2 flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}