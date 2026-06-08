import { useState, useEffect } from "react";
import api from "../services/api";
import { Search, Trash2, RefreshCw, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";

interface Log {
  id: string;
  level: string;
  source: string;
  action: string;
  message: string;
  meta: any;
  createdAt: string;
}

const LEVELS = ["all", "error", "warn", "info", "debug"];

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");

  async function fetchLogs() {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (level !== "all") params.level = level;
      if (search) params.search = search;
      if (source) params.source = source;
      const { data } = await api.get("/api/logs", { params });
      setLogs(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [level, source]);

  async function handleClear() {
    if (!confirm("Borrar logs mayores a 7 dias?")) return;
    try {
      await api.delete("/api/logs", { data: { days: 7 } });
      fetchLogs();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error");
    }
  }

  function levelIcon(l: string) {
    if (l === "error") return <AlertCircle size={14} style={{ color: "#EF4444" }} />;
    if (l === "warn") return <AlertTriangle size={14} style={{ color: "#F59E0B" }} />;
    if (l === "debug") return <Bug size={14} style={{ color: "var(--text-tertiary)" }} />;
    return <Info size={14} style={{ color: "#3B82F6" }} />;
  }

  function levelColor(l: string) {
    if (l === "error") return "rgba(239, 68, 68, 0.1)";
    if (l === "warn") return "rgba(245, 158, 11, 0.1)";
    return "transparent";
  }

  const sources = Array.from(new Set(logs.map(l => l.source))).filter(Boolean);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Logs del Sistema</h1>
          <p>{total} entradas (auto-refresh 5s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLogs} className="btn-secondary"><RefreshCw size={16} /> Refrescar</button>
          <button onClick={handleClear} className="btn-secondary"><Trash2 size={16} /> Limpiar &gt;7d</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
            placeholder="Buscar en mensaje, accion o source..."
            className="input w-full pl-10"
          />
        </div>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="input">
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
          <option value="">Todos los sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && logs.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--text-tertiary)" }}>Cargando logs...</div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12">
          <p style={{ color: "var(--text-tertiary)" }}>Sin logs. Los logs apareceran cuando ocurran acciones o errores.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="card !p-3 text-sm"
              style={{ background: levelColor(log.level) }}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{levelIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                      {log.source}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                      {log.action}
                    </span>
                  </div>
                  <p className="mt-1" style={{ color: "var(--text-primary)" }}>{log.message}</p>
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <pre className="mt-2 text-xs p-2 rounded overflow-x-auto" style={{ background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}>
                      {JSON.stringify(log.meta, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
