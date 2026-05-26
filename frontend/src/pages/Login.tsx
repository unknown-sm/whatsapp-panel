import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import ThemeToggle from "../components/ThemeToggle";
import { MessageSquare, AlertCircle } from "lucide-react";
import { initTheme } from "../store/themeStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  useEffect(() => {
    initTheme();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesion");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: "var(--accent)" }}>
            <MessageSquare size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>WhatsApp Panel</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>CRM con Automatizacion e IA</p>
        </div>
        <div className="card !p-6" style={{ boxShadow: "var(--shadow-lg)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Contrasena</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Ingresa tu contrasena" required />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm rounded-lg p-3" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}>
                <AlertCircle size={16} />{error}
              </div>
            )}
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center disabled:opacity-50">
              {isLoading ? "Iniciando sesion..." : "Iniciar Sesion"}
            </button>
          </form>
          <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: "var(--border-default)" }}>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Demo: admin@whatsapp-panel.com / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
