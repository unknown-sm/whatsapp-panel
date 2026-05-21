import { useEffect, useState } from "react";
import { Bot, MessageSquare, Clock, TrendingUp, DollarSign, Target, BarChart3, ArrowUpRight } from "lucide-react";
import { useBotStore } from "../store/botStore";
import api from "../services/api";

export default function Dashboard() {
  const { bots, fetchBots } = useBotStore();
  const [revenue, setRevenue] = useState<any>(null);

  useEffect(() => { fetchBots(); }, [fetchBots]);
  useEffect(() => {
    api.get("/pipeline/revenue/summary").then((res) => setRevenue(res.data)).catch(() => {});
  }, []);

  const activeBots = bots.filter((b) => b.isActive).length;
  const totalConversations = bots.reduce((sum, b) => sum + (b._count?.conversations || 0), 0);

  const stats = [
    { label: "Bots Activos", value: String(activeBots), icon: Bot, color: "var(--success)" },
    { label: "Conversaciones", value: String(totalConversations), icon: MessageSquare, color: "var(--info)" },
    { label: "Seguimientos", value: "0", icon: Clock, color: "var(--warning)" },
    { label: "Tasa de Respuesta", value: "0%", icon: TrendingUp, color: "var(--accent)" },
  ];

  const revenueStats = revenue ? [
    { label: "Valor Pipeline", value: `$${revenue.totalValue.toLocaleString()}`, icon: DollarSign, color: "var(--accent)" },
    { label: "Deals Ganados", value: `$${revenue.wonValue.toLocaleString()}`, icon: Target, color: "var(--success)" },
    { label: "Deals Abiertos", value: revenue.openDeals, icon: BarChart3, color: "var(--info)" },
    { label: "Conversion", value: `${revenue.conversionRate}%`, icon: ArrowUpRight, color: "var(--warning)" },
  ] : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
      
      {/* General Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card" style={{ border: "1px solid var(--border-default)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-muted)" }}>
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Stats */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {revenueStats.map((stat) => (
            <div key={stat.label} className="card" style={{ border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-muted)" }}>
                  <stat.icon size={22} style={{ color: stat.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ border: "1px solid var(--border-default)" }}>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Bienvenido a WhatsApp Panel</h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Comienza creando tu primer bot en la seccion de{" "}
          <a href="/bots" className="hover:underline" style={{ color: "var(--accent)" }}>Bots</a>, gestiona tu{" "}
          <a href="/pipeline" className="hover:underline" style={{ color: "var(--accent)" }}>Pipeline</a>, o revisa el{" "}
          <a href="/leadscoring" className="hover:underline" style={{ color: "var(--accent)" }}>Lead Scoring</a>.
        </p>
      </div>
    </div>
  );
}
