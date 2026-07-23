import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard, Bot, MessageSquare, Clock, Settings, LogOut,
  Menu, ChevronLeft, KanbanSquare, Target, Megaphone, BarChart3, FileText,
  FlaskConical, Send, Star, ClipboardList,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/conversations", icon: MessageSquare, label: "Conversaciones" },
  { to: "/bots", icon: Bot, label: "Bots" },
  { to: "/pipeline", icon: KanbanSquare, label: "Pipeline" },
  { to: "/followup", icon: Clock, label: "Seguimiento" },
  { to: "/leadscoring", icon: Target, label: "Lead Scoring" },
  { to: "/broadcasts", icon: Megaphone, label: "Broadcasts" },
  { to: "/templates", icon: Send, label: "Templates" },
  { to: "/lab", icon: FlaskConical, label: "Laboratorio" },
  { to: "/nps", icon: Star, label: "NPS" },
  { to: "/reports", icon: ClipboardList, label: "Reportes" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/logs", icon: FileText, label: "Logs" },
  { to: "/settings", icon: Settings, label: "Configuracion" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-[260px]" : "w-[72px]"} hidden md:flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`}
        style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
      >
        {/* Logo + org */}
        <div className="h-16 flex items-center gap-3 px-5 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
            <MessageSquare size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{user?.org?.name || "WhatsApp Panel"}</p>
              <p className="text-[10px] font-medium truncate" style={{ color: "var(--text-tertiary)" }}>
                {user?.org ? `Plan ${user.org.plan}` : "CRM"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
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

        {/* Footer */}
        <div className="p-2 border-t flex flex-col gap-1" style={{ borderColor: "var(--border-default)" }}>
          {sidebarOpen && user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--bg-muted)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                {(user.name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.name || user.email}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{user.role === "ADMIN" ? "Administrador" : "Agente"}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-1">
            <ThemeToggle />
            <button onClick={logout} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-tertiary)" }} title="Cerrar sesion">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Collapse button */}
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
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
