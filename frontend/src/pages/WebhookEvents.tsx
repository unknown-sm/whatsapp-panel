import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw, Webhook } from "lucide-react";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";

type EventStatus = "pending" | "processing" | "done" | "failed";

interface WebhookEventItem {
  id: string;
  phoneNumberId: string | null;
  status: EventStatus;
  attempts: number;
  nextRetryAt: string;
  lastError: string | null;
  receivedAt: string;
  processedAt: string | null;
}

const STATUS_LABELS: Record<EventStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  done: "Procesado",
  failed: "Fallido",
};

function statusStyle(status: EventStatus) {
  if (status === "done") return { background: "var(--success-muted)", color: "var(--success)" };
  if (status === "failed") return { background: "var(--danger-muted)", color: "var(--danger)" };
  if (status === "processing") return { background: "var(--info-muted)", color: "var(--info)" };
  return { background: "var(--warning-muted)", color: "var(--warning)" };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function WebhookEvents() {
  const user = useAuthStore((state) => state.user);
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [status, setStatus] = useState<"all" | EventStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchEvents = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/webhook-events", {
        params: { limit: 100, ...(status !== "all" ? { status } : {}) },
      });
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudieron cargar los eventos del webhook.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  async function retryEvent(id: string) {
    setRetryingId(id);
    setError("");
    setNotice("");
    try {
      await api.post(`/api/webhook-events/${id}/retry`);
      setNotice("Evento enviado a reintento. El estado se actualizará al procesarse.");
      await fetchEvents(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo reintentar el evento.");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Eventos de WhatsApp</h1>
          <p>Recepción, procesamiento y reintentos de los webhooks de Meta.</p>
        </div>
        <button onClick={() => fetchEvents()} className="btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap" role="group" aria-label="Filtrar eventos por estado">
        {(["all", "pending", "processing", "done", "failed"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={status === value ? "btn-primary" : "btn-secondary"}
            aria-pressed={status === value}
          >
            {value === "all" ? "Todos" : STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      {error && (
        <div className="card mb-4 flex items-center gap-2" role="alert" style={{ color: "var(--danger)" }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="card mb-4 flex items-center gap-2" role="status" style={{ color: "var(--success)" }}>
          <CheckCircle2 size={18} /> <span>{notice}</span>
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--text-tertiary)" }}>
          <Loader2 size={22} className="animate-spin mx-auto mb-2" /> Cargando eventos...
        </div>
      ) : events.length === 0 && !error ? (
        <div className="card text-center py-12">
          <Webhook size={28} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
          <p style={{ color: "var(--text-tertiary)" }}>No hay eventos con este filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="card !p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={statusStyle(event.status)}>
                      {STATUS_LABELS[event.status] || event.status}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {event.attempts} {event.attempts === 1 ? "intento" : "intentos"}
                    </span>
                    <span className="text-xs font-mono break-all" style={{ color: "var(--text-tertiary)" }}>
                      ID: {event.id}
                    </span>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Número Meta: <span className="font-mono">{event.phoneNumberId || "No identificado"}</span>
                  </p>
                </div>
                {user?.role === "ADMIN" && event.status === "failed" && (
                  <button
                    onClick={() => retryEvent(event.id)}
                    className="btn-secondary"
                    disabled={retryingId === event.id}
                  >
                    {retryingId === event.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    Reintentar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Recibido</span>
                  <p className="mt-1" style={{ color: "var(--text-primary)" }}>{formatDate(event.receivedAt)}</p>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Próximo reintento</span>
                  <p className="mt-1 flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                    <Clock3 size={13} /> {event.status === "pending" ? formatDate(event.nextRetryAt) : "—"}
                  </p>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Procesado</span>
                  <p className="mt-1" style={{ color: "var(--text-primary)" }}>{formatDate(event.processedAt)}</p>
                </div>
              </div>

              {event.lastError && (
                <div className="mt-4 p-3 rounded-lg text-sm break-words" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}>
                  <strong>Último error:</strong> {event.lastError}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
