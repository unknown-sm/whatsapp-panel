import { useEffect, useState } from "react";
import api from "../services/api";
import {
  Users, MessageSquare, Bot, DollarSign, TrendingUp, Target,
  BarChart3, Radio, Award, TrendingDown, Minus, Loader2,
} from "lucide-react";
import { Badge } from "../components/ui/Badge";

export default function Analytics() {
  const [overview, setOverview] = useState<any>(null);
  const [messagesOverTime, setMessagesOverTime] = useState<any[]>([]);
  const [contactGrowth, setContactGrowth] = useState<any[]>([]);
  const [dealFunnel, setDealFunnel] = useState<any[]>([]);
  const [topBots, setTopBots] = useState<any[]>([]);
  const [revenueSource, setRevenueSource] = useState<any[]>([]);
  const [agentPerf, setAgentPerf] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ov, msg, cg, df, tb, rs, ap, fc] = await Promise.all([
          api.get("/api/analytics/overview"),
          api.get("/api/analytics/messages-over-time"),
          api.get("/api/analytics/contact-growth"),
          api.get("/api/analytics/deal-funnel"),
          api.get("/api/analytics/top-bots"),
          api.get("/api/analytics/revenue-source"),
          api.get("/api/analytics/agent-performance"),
          api.get("/api/analytics/forecast"),
        ]);
        setOverview(ov.data);
        setMessagesOverTime(msg.data);
        setContactGrowth(cg.data);
        setDealFunnel(df.data);
        setTopBots(tb.data);
        setRevenueSource(rs.data);
        setAgentPerf(ap.data);
        setForecast(fc.data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const maxMessages = Math.max(...messagesOverTime.map((d) => d.count), 1);
  const maxContacts = Math.max(...contactGrowth.map((d) => d.total), 1);
  const maxFunnel = Math.max(...dealFunnel.map((d) => d.count), 1);

  if (loading) return <div className="flex items-center justify-center py-12 text-ink-3"><Loader2 className="animate-spin mr-2" size={20} />Cargando...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Analytics</h1><p>Metricas y estadisticas del sistema</p></div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Contactos", value: overview.totalContacts, icon: Users },
            { label: "Conversaciones", value: overview.totalConversations, icon: MessageSquare },
            { label: "Mensajes", value: overview.totalMessages, icon: BarChart3 },
            { label: "Deals", value: overview.totalDeals, icon: Target },
            { label: "Ganados", value: overview.wonDeals, icon: TrendingUp },
            { label: "Revenue", value: `$${(overview.totalValue || 0).toLocaleString()}`, icon: DollarSign },
            { label: "Conversion", value: `${overview.conversionRate}%`, icon: TrendingUp },
            { label: "Bots Activos", value: overview.activeBots, icon: Bot },
          ].map((s) => (
            <div key={s.label} className="card p-3">
              <div className="flex items-center gap-2 mb-1"><s.icon size={14} className="text-ink-3" /><span className="text-[11px] text-ink-2">{s.label}</span></div>
              <p className="text-[20px] font-[650] text-ink tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight">Mensajes (30 dias)</h3>
          {messagesOverTime.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {messagesOverTime.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full rounded-t" style={{ height: `${(d.count / maxMessages) * 100}%`, minHeight: d.count > 0 ? 4 : 0, background: d.count > 0 ? "var(--accent)" : "var(--bg-muted)", opacity: d.count > 0 ? 0.8 : 0.2 }} title={`${d.date}: ${d.count}`} />
                  {i % 5 === 0 && <span className="text-[9px] text-ink-3">{d.date.slice(5)}</span>}
                </div>
              ))}
            </div>
          ) : <div className="h-40 flex items-center justify-center text-ink-3 text-sm">Sin datos</div>}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight">Contactos (30 dias)</h3>
          {contactGrowth.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {contactGrowth.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t" style={{ height: `${(d.total / maxContacts) * 100}%`, minHeight: d.total > 0 ? 4 : 0, background: "var(--info)", opacity: 0.7 }} title={`${d.date}: +${d.new}, ${d.total} total`} />
                  {i % 5 === 0 && <span className="text-[9px] text-ink-3">{d.date.slice(5)}</span>}
                </div>
              ))}
            </div>
          ) : <div className="h-40 flex items-center justify-center text-ink-3 text-sm">Sin datos</div>}
        </div>
      </div>

      {/* ── Forecast + Revenue by Source ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {forecast && (
          <div className="card p-4">
            <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight flex items-center gap-2">
              <Award size={14} className="text-warn-chip-text" />Pronóstico
            </h3>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[28px] font-[650] text-ink tracking-tight">${forecast.nextMonth?.toLocaleString() || 0}</p>
                <p className="text-[11px] text-ink-3 mt-1">Proximo mes estimado</p>
              </div>
              <Badge variant={forecast.trend === "up" ? "success" : forecast.trend === "down" ? "danger" : "default"}>
                {forecast.trend === "up" ? <TrendingUp size={10} className="mr-1" /> : forecast.trend === "down" ? <TrendingDown size={10} className="mr-1" /> : <Minus size={10} className="mr-1" />}
                {forecast.trend === "up" ? "Al alza" : forecast.trend === "down" ? "Baja" : "Estable"}
              </Badge>
            </div>
            {forecast.past?.length > 0 && (
              <div className="mt-3 space-y-1">
                {forecast.past.slice(-3).map((m: any) => (
                  <div key={m.month} className="flex justify-between text-[11.5px]">
                    <span className="text-ink-2">{m.month}</span>
                    <span className="font-[600] text-ink">${m.revenue?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {revenueSource.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight flex items-center gap-2">
              <Radio size={14} className="text-ink-3" />Revenue por fuente
            </h3>
            <div className="space-y-2">
              {revenueSource.map((s) => (
                <div key={s.source} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--bg-panel)" }}>
                  <div>
                    <p className="text-[12.5px] font-[600] text-ink">{s.source}</p>
                    <p className="text-[10.5px] text-ink-3">{s.leads} leads · {s.conversions} conv</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-[650] text-ink">${s.revenue?.toLocaleString()}</p>
                    <p className="text-[10px] text-ink-3">ROAS ${s.roas}/lead</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Deal Funnel + Agent Performance ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight">Embudo de Ventas</h3>
          {dealFunnel.length > 0 ? (
            <div className="space-y-2">
              {dealFunnel.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-[12px] w-28 truncate text-ink-2">{stage.stage}</span>
                  <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(stage.count / maxFunnel) * 100}%`, background: stage.color, opacity: 0.8 }} />
                  </div>
                  <span className="text-[12px] font-[600] text-ink w-8 text-right">{stage.count}</span>
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-ink-3 text-sm">Sin datos</div>}
        </div>

        {agentPerf.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight">Performance Agentes</h3>
            <div className="space-y-2">
              {agentPerf.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--bg-panel)" }}>
                  <div>
                    <p className="text-[12.5px] font-[600] text-ink">{a.name}</p>
                    <p className="text-[10.5px] text-ink-3">{a.totalResponses} respuestas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-[650] text-ink">{a.wonDeals}/{a.assignedDeals}</p>
                    <Badge variant={a.conversionRate > 30 ? "success" : "default"}>{a.conversionRate}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Bots */}
      {topBots.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="text-sm font-[650] mb-3 text-ink tracking-tight">Top Bots</h3>
          <div className="space-y-2">
            {topBots.map((bot, i) => (
              <div key={bot.id} className="flex items-center gap-3 p-2 rounded" style={{ background: "var(--bg-panel)" }}>
                <span className="text-[11px] font-[600] text-ink-3 w-5 text-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-[12.5px] font-[600] text-ink">{bot.name}</p>
                  <p className="text-[10.5px] text-ink-3">{bot.conversations} conversaciones</p>
                </div>
                <Badge variant={bot.isActive ? "success" : "default"}>{bot.isActive ? "Activo" : "Inactivo"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
