import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard, Bot, MessageSquare, Clock, Settings, LogOut, Menu, X, ChevronRight, KanbanSquare, Target, Megaphone, BarChart3
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bots", icon: Bot, label: "Bots" },
  { to: "/conversations", icon: MessageSquare, label: "Conversaciones" },
  { to: "/followup", icon: Clock, label: "Seguimiento" },
  { to: "/pipeline", icon: KanbanSquare, label: "Pipeline" },
  { to: "/leadscoring", icon: Target, label: "Lead Scoring" },
  { to: "/broadcasts", icon: Megaphone, label: "Broadcasts" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Configuracion" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  return (
    <div className="flex h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`} style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}>
        {/* Logo/header */}
        <div className="h-14 flex items-center justify-between px-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          {sidebarOpen && (
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              WhatsApp Panel
            </span>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-tertiary)" }} title={sidebarOpen ? "Colapsar" : "Expandir"}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                {sidebarOpen && <span>{item.label}</span>}
                {isActive && sidebarOpen && <ChevronRight size={14} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>
        
        {/* User section */}
        <div className="p-2 border-t" style={{ borderColor: "var(--border-default)" }}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "var(--bg-muted)" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{user?.name || user?.email}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{user?.role === "ADMIN" ? "Administrador" : "Agente"}</p>
              </div>
              <button onClick={logout} className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: "var(--text-tertiary)" }} title="Cerrar sesion">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={logout} className="w-full flex justify-center p-2 rounded-lg transition-colors" style={{ color: "var(--text-tertiary)" }} title="Cerrar sesion">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
            <span className="text-sm">Panel de control</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>
        
        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
