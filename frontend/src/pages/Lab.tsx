import { useState, useEffect } from "react";
import api from "../services/api";
import {
  FlaskConical, Play, Loader2, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, TrendingDown, Sparkles, Plus, ChevronRight,
} from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

interface Persona {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface Hallazgo {
  tipo: string;
  descripcion: string;
  gravedad?: string;
  pregunta?: string;
  respuesta_sugerida?: string;
}

interface Case {
  id: string;
  personaId: string;
  personaName: string;
  veredicto: string | null;
  score: number | null;
  hallazgos: Hallazgo[] | null;
  transcript: { role: string; content: string }[] | null;
}

interface Run {
  id: string;
  status: string;
  score: number | null;
  startedAt: string;
  endedAt: string | null;
  cases: Case[];
  _count?: { cases: number };
}

const veredictoColors: Record<string, "success" | "warning" | "danger"> = {
  verde: "success",
  amarillo: "warning",
  rojo: "danger",
};

const tipoLabels: Record<string, string> = {
  alucinacion: "Alucinación",
  fuera_de_kb: "Fuera de KB",
  debio_escalar: "Debió escalar",
  tono: "Tono inapropiado",
  precio: "Manejo de precio",
  largo: "Demasiado largo",
  corto: "Demasiado corto",
  sugerencia: "Sugerencia KB",
  general: "General",
  error: "Error",
};

const gravedadColors: Record<string, string> = {
  alta: "text-danger",
  media: "text-warning",
  baja: "text-ink-3",
};

export default function Lab() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInitial(); }, []);

  useEffect(() => {
    if (running && activeRun) {
      const interval = setInterval(async () => {
        try {
          const { data } = await api.get(`/api/lab/runs/${activeRun.id}`);
          setActiveRun(data.run);
          if (data.run.status !== "running") {
            setRunning(false);
            clearInterval(interval);
            loadRecent();
          }
        } catch { clearInterval(interval); }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [running, activeRun]);

  async function loadInitial() {
    setLoading(true);
    try {
      const [personasRes, runsRes] = await Promise.all([
        api.get("/api/lab/personas"),
        api.get("/api/lab/runs"),
      ]);
      setPersonas(personasRes.data.personas || []);
      setRecentRuns(runsRes.data.runs || []);
    } finally { setLoading(false); }
  }

  async function loadRecent() {
    const { data } = await api.get("/api/lab/runs");
    setRecentRuns(data.runs || []);
  }

  async function loadRun(id: string) {
    const { data } = await api.get(`/api/lab/runs/${id}`);
    setActiveRun(data.run);
  }

  async function startRun() {
    if (selectedPersonas.length === 0) return;
    setRunning(true);
    try {
      const { data } = await api.post("/api/lab/runs", { personaIds: selectedPersonas });
      const { data: runData } = await api.get(`/api/lab/runs/${data.runId}`);
      setActiveRun(runData.run);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al iniciar test");
      setRunning(false);
    }
  }

  function togglePersona(id: string) {
    setSelectedPersonas((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  const veredictoVariant = (v: string | null) => veredictoColors[v || ""] || "default";

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-3"><Loader2 className="animate-spin mr-2" size={20} />Cargando laboratorio...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-warn-chip-bg border border-warn-chip-border flex items-center justify-center">
            <FlaskConical size={20} className="text-warn-chip-text" />
          </div>
          <div>
            <h1>Laboratorio</h1>
            <p>Red-team automático del agente con clientes simulados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: personas + run ──────────────────────── */}
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-[650] text-ink tracking-tight">Personas de prueba</h3>
              <Badge variant="default">{selectedPersonas.length}/{personas.length}</Badge>
            </div>
            <div className="space-y-2">
              {personas.map((p) => {
                const selected = selectedPersonas.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePersona(p.id)}
                    disabled={running}
                    className={`w-full text-left p-2.5 rounded-md border transition-all ${selected ? "border-brand bg-brand-tint" : "border-border bg-background hover:bg-atlas-hover"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-[20px]">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12.5px] font-[600] text-ink">{p.name}</p>
                          {selected && <CheckCircle2 size={12} className="text-brand-text" />}
                        </div>
                        <p className="text-[11px] text-ink-3 mt-0.5 line-clamp-2">{p.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={startRun}
              disabled={selectedPersonas.length === 0 || running}
              className="w-full mt-3"
            >
              {running ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
              {running ? "Ejecutando..." : `Iniciar test (${selectedPersonas.length})`}
            </Button>
          </div>

          <div className="card">
            <h3 className="text-[14px] font-[650] text-ink tracking-tight mb-3">Historial</h3>
            {recentRuns.length === 0 ? (
              <p className="text-[12px] text-ink-3 text-center py-3">Sin tests previos</p>
            ) : (
              <div className="space-y-1.5">
                {recentRuns.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => loadRun(r.id)}
                    className={`w-full text-left p-2 rounded-md border transition-colors ${activeRun?.id === r.id ? "border-brand bg-brand-tint" : "border-border hover:bg-atlas-hover"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.status === "running" ? (
                          <Loader2 className="animate-spin text-info" size={12} />
                        ) : r.score !== null && r.score >= 70 ? (
                          <CheckCircle2 className="text-success" size={12} />
                        ) : r.score !== null && r.score >= 40 ? (
                          <AlertTriangle className="text-warning" size={12} />
                        ) : (
                          <XCircle className="text-danger" size={12} />
                        )}
                        <span className="text-[12px] font-medium text-ink">
                          {r.score !== null ? `Score ${r.score}` : "..."}
                        </span>
                        <span className="text-[10.5px] text-ink-3">
                          {r._count?.cases || r.cases?.length || 0} casos
                        </span>
                      </div>
                      <span className="text-[10.5px] text-ink-3">
                        {new Date(r.startedAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: active run results ──────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!activeRun ? (
            <div className="card text-center py-12">
              <FlaskConical size={36} className="mx-auto mb-3 text-ink-3 opacity-50" />
              <p className="text-[14px] font-[650] text-ink tracking-tight">Selecciona personas y ejecuta un test</p>
              <p className="text-[12px] text-ink-3 mt-1">Los resultados aparecerán aquí con score, hallazgos y sugerencias para mejorar la KB.</p>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-[650] text-ink tracking-tight">Run {activeRun.id.substring(0, 8)}</h3>
                    <p className="text-[11.5px] text-ink-3 mt-0.5">
                      Iniciado {new Date(activeRun.startedAt).toLocaleString("es")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {activeRun.status === "running" ? (
                      <Badge variant="warning"><Loader2 className="animate-spin mr-1" size={10} />En progreso</Badge>
                    ) : (
                      <Badge variant={veredictoVariant(activeRun.score !== null && activeRun.score >= 70 ? "verde" : activeRun.score !== null && activeRun.score >= 40 ? "amarillo" : "rojo")}>
                        {activeRun.score !== null && activeRun.score >= 70 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                        Score: {activeRun.score}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {activeRun.cases?.map((c) => (
                <div key={c.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-[13px] font-[650] text-ink tracking-tight">{c.personaName}</h4>
                      <p className="text-[11px] text-ink-3 mt-0.5">{c.transcript?.length || 0} turnos</p>
                    </div>
                    <Badge variant={veredictoVariant(c.veredicto)}>
                      {c.veredicto || "..."} · {c.score || 0}/100
                    </Badge>
                  </div>

                  {c.transcript && c.transcript.length > 0 && (
                    <details className="mb-3">
                      <summary className="text-[11.5px] text-ink-2 cursor-pointer hover:text-ink transition-colors flex items-center gap-1">
                        <ChevronRight size={12} /> Ver transcripción
                      </summary>
                      <div className="mt-2 space-y-1.5 p-3 rounded-md bg-atlas-subtle border border-border">
                        {c.transcript.map((m, i) => (
                          <div key={i} className={`text-[12px] ${m.role === "user" ? "text-ink-2" : "text-ink"}`}>
                            <span className="font-[600]">{m.role === "user" ? "Cliente" : "Agente"}:</span> {m.content}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {c.hallazgos && c.hallazgos.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="section-label">Hallazgos ({c.hallazgos.length})</h5>
                      {c.hallazgos.map((h, i) => (
                        <div key={i} className="p-2.5 rounded-md" style={{ background: "var(--warn-chip-bg)", border: "1px solid var(--warn-chip-border)" }}>
                          <div className="flex items-start gap-2">
                            <Sparkles size={12} className="text-warn-chip-text mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-[600] text-warn-chip-text uppercase tracking-wide">{tipoLabels[h.tipo] || h.tipo}</span>
                                {h.gravedad && <span className={`text-[10.5px] ${gravedadColors[h.gravedad]}`}>({h.gravedad})</span>}
                              </div>
                              <p className="text-[12px] text-ink leading-relaxed">{h.descripcion}</p>
                              {h.tipo === "sugerencia" && h.pregunta && (
                                <Button size="sm" variant="outline" className="mt-2 text-[10.5px] !py-0.5 !px-2 !h-6">
                                  <Plus size={10} />Aplicar a KB
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}