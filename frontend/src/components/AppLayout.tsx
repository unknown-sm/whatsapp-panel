import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useTranslation } from "react-i18next";
import { useAgentChatStore } from "../store/agentChatStore";
import ThemeToggle from "./ThemeToggle";
import AgentChatPanel from "./AgentChatPanel";
import {
  LayoutDashboard, Bot, MessageSquare, Clock, Settings, LogOut,
  Menu, ChevronLeft, KanbanSquare, Target, Megaphone, BarChart3, FileText,
  FlaskConical, Send, Star, ClipboardList, Globe, MessageCircle,
} from "lucide-react";

const languages: Record<string, { label: string; flag: string }> = {
  es: { label: "ES", flag: "\ud83c\uddea\ud83c\uddf8" },
  "pt-BR": { label: "PT", flag: "\ud83c\udde7\ud83c\uddf7" },
  en: { label: "EN", flag: "\ud83c\uddec\ud83c\udde7" },
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [headerLangOpen, setHeaderLangOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { unreadTotal, open: openChat, fetchUnread, connectSocket, disconnectSocket } = useAgentChatStore();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      connectSocket(token);
      fetchUnread();
    }
    return () => disconnectSocket();
  }, []);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/conversations", icon: MessageSquare, label: t("sidebar.conversations") },
    { to: "/bots", icon: Bot, label: t("sidebar.bots") },
    { to: "/pipeline", icon: KanbanSquare, label: t("sidebar.pipeline") },
    { to: "/followup", icon: Clock, label: t("sidebar.followup") },
    { to: "/leadscoring", icon: Target, label: t("sidebar.leadscoring") },
    { to: "/broadcasts", icon: Megaphone, label: t("sidebar.broadcasts") },
    { to: "/templates", icon: Send, label: t("sidebar.templates") },
    { to: "/lab", icon: FlaskConical, label: t("sidebar.lab") },
    { to: "/nps", icon: Star, label: t("sidebar.nps") },
    { to: "/reports", icon: ClipboardList, label: t("sidebar.reports") },
    { to: "/analytics", icon: BarChart3, label: t("sidebar.analytics") },
    { to: "/logs", icon: FileText, label: t("sidebar.logs") },
    { to: "/settings", icon: Settings, label: t("sidebar.settings") },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLangMenuOpen(false);
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-[260px]" : "w-[72px]"} hidden md:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`}
        style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
            <MessageSquare size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{user?.org?.name || "WhatsApp Panel"}</p>
              <p className="text-[10px] font-medium truncate" style={{ color: "var(--text-tertiary)" }}>
                {user?.org ? t("app.plan", { plan: user.org.plan }) : "CRM"}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium whitespace-nowrap ${
                  isActive ? "nav-item-active" : ""
                }`}
                style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className="flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t flex flex-col gap-1" style={{ borderColor: "var(--border-default)" }}>
          {sidebarOpen && user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--bg-muted)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                {(user.name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.name || user.email}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{user.role === "ADMIN" ? t("roles.admin") : t("roles.agent")}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-1">
            {/* Language switcher */}
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)] flex items-center gap-1"
                style={{ color: "var(--text-tertiary)" }} title="Cambiar idioma">
                <Globe size={16} />
                {sidebarOpen && <span className="text-[10px] font-medium">{languages[i18n.language]?.label || "ES"}</span>}
              </button>
              {langMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-28 rounded-lg border shadow-lg z-50" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
                  {Object.entries(languages).map(([code, info]) => (
                    <button key={code} onClick={() => changeLanguage(code)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:opacity-80 ${i18n.language === code ? "font-bold" : ""}`}
                      style={{ color: i18n.language === code ? "var(--accent)" : "var(--text-secondary)" }}>
                      <span>{info.flag}</span> {info.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
            <button onClick={logout} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-tertiary)" }} title={t("sidebar.logout")}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border flex items-center justify-center transition-transform duration-300 z-10"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${!sidebarOpen ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
          <aside className="w-[260px] h-full flex flex-col" style={{ background: "var(--bg-surface)" }}>
            <div className="h-16 flex items-center gap-3 px-5 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
                <MessageSquare size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>WhatsApp Panel</p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>CRM</p>
              </div>
            </div>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${isActive ? "nav-item-active" : ""}`}
                    style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg md:hidden transition-colors" style={{ color: "var(--text-tertiary)" }}>
              <Menu size={20} />
            </button>
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {navItems.find((i) => location.pathname === i.to || (i.to !== "/" && location.pathname.startsWith(i.to)))?.label || "Dashboard"}
            </span>
          </div>

          {/* Language switcher in header (mobile) */}
          <div className="flex items-center gap-2">
            {/* Agent chat button */}
            <button onClick={openChat} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)] relative"
              style={{ color: "var(--text-tertiary)" }}>
              <MessageCircle size={18} />
              {unreadTotal > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold px-1 rounded-full"
                  style={{ background: "var(--danger)", color: "#fff", minWidth: 16, textAlign: "center", lineHeight: "16px" }}>
                  {unreadTotal > 9 ? "9+" : unreadTotal}
                </span>
              )}
            </button>
            <div className="relative">
              <button onClick={() => setHeaderLangOpen(!headerLangOpen)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)] flex items-center gap-1 md:hidden"
                style={{ color: "var(--text-tertiary)" }}>
                <Globe size={16} />
                <span className="text-[10px] font-medium">{languages[i18n.language]?.label || "ES"}</span>
              </button>
              {headerLangOpen && (
                <div className="absolute top-full right-0 mt-1 w-28 rounded-lg border shadow-lg z-50" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
                  {Object.entries(languages).map(([code, info]) => (
                    <button key={code} onClick={() => { i18n.changeLanguage(code); setHeaderLangOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:opacity-80 ${i18n.language === code ? "font-bold" : ""}`}
                      style={{ color: i18n.language === code ? "var(--accent)" : "var(--text-secondary)" }}>
                      <span>{info.flag}</span> {info.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6" style={{ overflowX: "hidden" }}>
          <Outlet />
        </div>
      </main>

      <AgentChatPanel />
    </div>
  );
}
