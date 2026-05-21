import { useEffect, useState } from "react";
import api from "../services/api";
import { Users, MessageSquare, Bot, DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";

export default function Analytics() {
  const [overview, setOverview] = useState<any>(null);
  const [messagesOverTime, setMessagesOverTime] = useState<any[]>([]);
  const [contactGrowth, setContactGrowth] = useState<any[]>([]);
  const [dealFunnel, setDealFunnel] = useState<any[]>([]);
  const [topBots, setTopBots] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      try {
        const [ov, msg, cg, df, tb] = await Promise.all([
          api.get("/analytics/overview"),
          api.get("/analytics/messages-over-time"),
          api.get("/analytics/contact-growth"),
          api.get("/analytics/deal-funnel"),
          api.get("/analytics/top-bots"),
        ]);
        setOverview(ov.data);
        setMessagesOverTime(msg.data);
        setContactGrowth(cg.data);
        setDealFunnel(df.data);
        setTopBots(tb.data);
      } catch (e) {
        // ignore
      }
    }
    load();
  }, []);

  const maxMessages = Math.max(...messagesOverTime.map((d) => d.count), 1);
  const maxContacts = Math.max(...contactGrowth.map((d) => d.total), 1);
  const maxFunnel = Math.max(...dealFunnel.map((d) => d.count), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Analytics</h1>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Contactos", value: overview.totalContacts, icon: Users },
            { label: "Conversaciones", value: overview.totalConversations, icon: MessageSquare },
            { label: "Mensajes", value: overview.totalMessages, icon: BarChart3 },
            { label: "Bots Activos", value: overview.activeBots, icon: Bot },
            { label: "Deals", value: overview.totalDeals, icon: Target },
            { label: "Ganados", value: overview.wonDeals, icon: TrendingUp },
            { label: "Valor Total", value: `$${overview.totalValue.toLocaleString()}`, icon: DollarSign },
            { label: "Conversion", value: `${overview.conversionRate}%`, icon: TrendingUp },
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Messages Over Time */}
        <div className="card p-4" style={{ border: "1px solid var(--border-default)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Mensajes (ultimos 30 dias)</h3>
          {messagesOverTime.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {messagesOverTime.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${(d.count / maxMessages) * 100}%`,
                      minHeight: d.count > 0 ? "4px" : "0",
                      background: d.count > 0 ? "var(--accent)" : "var(--bg-muted)",
                      opacity: d.count > 0 ? 0.8 : 0.2,
                    }}
                    title={`${d.date}: ${d.count} mensajes`}
                  />
                  {i % 5 === 0 && (
                    <span className="text-[9px] truncate w-full text-center" style={{ color: "var(--text-tertiary)" }}>
                      {d.date.slice(5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>Sin datos</div>
          )}
        </div>

        {/* Contact Growth */}
        <div className="card p-4" style={{ border: "1px solid var(--border-default)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Crecimiento de Contactos</h3>
          {contactGrowth.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {contactGrowth.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${(d.total / maxContacts) * 100}%`,
                      minHeight: d.total > 0 ? "4px" : "0",
                      background: "var(--info)",
                      opacity: 0.7,
                    }}
                    title={`${d.date}: ${d.new} nuevos, ${d.total} total`}
                  />
                  {i % 5 === 0 && (
                    <span className="text-[9px] truncate w-full text-center" style={{ color: "var(--text-tertiary)" }}>
                      {d.date.slice(5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>Sin datos</div>
          )}
        </div>
      </div>

      {/* Deal Funnel + Top Bots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deal Funnel */}
        <div className="card p-4" style={{ border: "1px solid var(--border-default)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Embudo de Ventas</h3>
          {dealFunnel.length > 0 ? (
            <div className="space-y-2">
              {dealFunnel.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-sm w-28 truncate" style={{ color: "var(--text-secondary)" }}>{stage.stage}</span>
                  <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(stage.count / maxFunnel) * 100}%`,
                        background: stage.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right" style={{ color: "var(--text-primary)" }}>{stage.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Sin datos</div>
          )}
        </div>

        {/* Top Bots */}
        <div className="card p-4" style={{ border: "1px solid var(--border-default)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Top Bots</h3>
          {topBots.length > 0 ? (
            <div className="space-y-2">
              {topBots.map((bot, i) => (
                <div key={bot.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "var(--bg-muted)" }}>
                  <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--text-tertiary)" }}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{bot.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{bot.conversations} conversaciones</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${bot.isActive ? "badge-success" : "badge"}`}>
                    {bot.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
}
