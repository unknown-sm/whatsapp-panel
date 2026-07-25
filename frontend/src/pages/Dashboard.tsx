import { useEffect, useState } from "react";
import { Bot, MessageSquare, Clock, TrendingUp, DollarSign, Target, BarChart3, ArrowUpRight } from "lucide-react";
import { useBotStore } from "../store/botStore";
import { useTranslation } from "react-i18next";
import api from "../services/api";

export default function Dashboard() {
  const { t } = useTranslation();
  const { bots, fetchBots } = useBotStore();
  const [revenue, setRevenue] = useState<any>(null);

  useEffect(() => { fetchBots(); }, [fetchBots]);
  useEffect(() => {
    api.get("/api/pipeline/revenue/summary").then((res) => setRevenue(res.data)).catch(() => {});
  }, []);

  const activeBots = bots.filter((b) => b.isActive).length;
  const totalConversations = bots.reduce((sum, b) => sum + (b._count?.conversations || 0), 0);

  const stats = [
    { label: t("dashboard.active_bots"), value: String(activeBots), icon: Bot, color: "var(--success)" },
    { label: t("dashboard.conversations"), value: String(totalConversations), icon: MessageSquare, color: "var(--info)" },
    { label: t("dashboard.followups"), value: "0", icon: Clock, color: "var(--warning)" },
    { label: t("dashboard.response_rate"), value: "0%", icon: TrendingUp, color: "var(--accent)" },
  ];

  const revenueStats = revenue ? [
    { label: t("dashboard.pipeline_value"), value: `$${revenue.totalValue.toLocaleString()}`, icon: DollarSign, color: "var(--accent)" },
    { label: t("dashboard.won_deals"), value: `$${revenue.wonValue.toLocaleString()}`, icon: Target, color: "var(--success)" },
    { label: t("dashboard.open_deals"), value: String(revenue.openDeals), icon: BarChart3, color: "var(--info)" },
    { label: t("dashboard.conversion"), value: `${revenue.conversionRate}%`, icon: ArrowUpRight, color: "var(--warning)" },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)" }}>
              <stat.icon size={22} style={{ color: stat.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {revenueStats.map((stat) => (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)" }}>
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card !p-6">
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t("dashboard.welcome_title")}</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {t("dashboard.welcome_text")}
        </p>
      </div>
    </div>
  );
}
