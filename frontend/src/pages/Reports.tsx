import { useState, useEffect } from "react";
import api from "../services/api";
import {
  FileText, RefreshCw, Loader2, Calendar, TrendingUp, Users,
  MessageSquare, DollarSign, Target, BarChart3, Download,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

interface Report {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  data: any;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<Report | null>(null);

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/reports/recent");
      setReports(data.reports || []);
      if (data.reports?.[0]) setActive(data.reports[0]);
    } finally { setLoading(false); }
  }

  async function generateNow(period: "daily" | "weekly" | "monthly" = "daily") {
    setGenerating(true);
    try {
      await api.post("/api/reports/generate", { period });
      fetchReports();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally { setGenerating(false); }
  }

  function downloadText() {
    if (!active) return;
    const txt = `Reporte ${active.period}\n` +
      `Periodo: ${new Date(active.periodStart).toLocaleDateString("es")} → ${new Date(active.periodEnd).toLocaleDateString("es")}\n\n` +
      `Nuevas conversaciones: ${active.data?.summary?.newConversations ?? 0}\n` +
      `Nuevos contactos: ${active.data?.summary?.newContacts ?? 0}\n` +
      `Mensajes: ${active.data?.summary?.totalMessages ?? 0}\n` +
      `Deals nuevos: ${active.data?.summary?.newDeals ?? 0}\n` +
      `Deals ganados: ${active.data?.summary?.wonDeals ?? 0}\n` +
      `Revenue: $${(active.data?.summary?.revenue ?? 0).toLocaleString()}\n` +
      `Conversion: ${active.data?.summary?.conversionRate ?? 0}%\n` +
      `Lead points: ${active.data?.summary?.leadPoints ?? 0}\n`;

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${active.period}-${new Date(active.periodStart).toISOString().split("T")[0]}.txt`;
    a.click();
  }

  const summary = active?.data?.summary;
  const topBots = active?.data?.topBots || [];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand-soft flex items-center justify-center">
            <FileText size={20} className="text-brand-text" />
          </div>
          <div>
            <h1>Reportes</h1>
            <p>Snapshots automaticos diarios con KPIs clave del CRM</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadText} disabled={!active}>
            <Download size={14} />Exportar
          </Button>
          <Button onClick={() => generateNow("daily")} disabled={generating} size="sm">
            {generating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            {generating ? "Generando..." : "Generar ahora"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ── Report list ─────────────────────── */}
        <div className="lg:col-span-1">
          <div className="card p-0 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h3 className="section-label">Historial</h3>
              <Badge variant="default">{reports.length}</Badge>
            </div>
            {loading ? (
              <div className="p-4 text-center text-ink-3"><Loader2 className="animate-spin mx-auto" size={16} /></div>
            ) : reports.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-ink-3">Sin reportes. Click "Generar ahora".</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActive(r)}
                    className={`w-full text-left p-3 border-b border-border transition-colors ${active?.id === r.id ? "bg-brand-tint" : "hover:bg-atlas-hover"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-ink-3" />
                      <span className="text-[12px] font-[600] text-ink uppercase tracking-wide">{r.period}</span>
                    </div>
                    <p className="text-[11px] text-ink-2 mt-0.5">
                      {new Date(r.periodStart).toLocaleDateString("es", { day: "2-digit", month: "short" })} → {new Date(r.periodEnd).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    </p>
                    <p className="text-[10.5px] text-ink-3 mt-0.5">
                      Generado {new Date(r.generatedAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Report detail ──────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {!active ? (
            <div className="card text-center py-12">
              <BarChart3 size={36} className="mx-auto mb-3 text-ink-3 opacity-50" />
              <p className="text-[14px] font-[650] text-ink">Selecciona un reporte</p>
            </div>
          ) : (
            <>
              <div className="card">
                <h3 className="text-[15px] font-[650] text-ink tracking-tight">
                  Reporte {active.period.toUpperCase()}
                </h3>
                <p className="text-[11.5px] text-ink-3 mt-1">
                  {new Date(active.periodStart).toLocaleString("es")} → {new Date(active.periodEnd).toLocaleString("es")}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={MessageSquare} label="Conversaciones" value={summary?.newConversations ?? 0} />
                <KpiCard icon={Users} label="Contactos" value={summary?.newContacts ?? 0} />
                <KpiCard icon={Target} label="Deals ganados" value={summary?.wonDeals ?? 0} />
                <KpiCard icon={DollarSign} label="Revenue" value={`$${(summary?.revenue ?? 0).toLocaleString()}`} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={MessageSquare} label="Mensajes" value={summary?.totalMessages ?? 0} small />
                <KpiCard icon={BarChart3} label="Conversion" value={`${summary?.conversionRate ?? 0}%`} small />
                <KpiCard icon={TrendingUp} label="Lead points" value={summary?.leadPoints ?? 0} small />
                <KpiCard icon={RefreshCw} label="Follow-ups" value={summary?.newFollowUps ?? 0} small />
              </div>

              {topBots.length > 0 && (
                <div className="card">
                  <h3 className="text-[14px] font-[650] text-ink tracking-tight mb-3">Top bots por conversaciones</h3>
                  <div className="space-y-2">
                    {topBots.map((b: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-md border border-border">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-brand-soft text-brand-text flex items-center justify-center text-[11px] font-[600]">
                            {i + 1}
                          </span>
                          <code className="text-[11.5px] text-ink-2">{b.botId?.slice(0, 8) || "bot"}</code>
                        </div>
                        <span className="text-[12.5px] font-[600] text-ink">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, small = false }: { icon: any; label: string; value: any; small?: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={small ? 12 : 14} className="text-ink-3" />
        <span className="text-[10.5px] uppercase tracking-wide text-ink-3">{label}</span>
      </div>
      <p className={`font-[650] text-ink tracking-tight ${small ? "text-[18px]" : "text-[22px]"}`}>{value}</p>
    </div>
  );
}
