import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import ThemeToggle from "../components/ThemeToggle";
import { MessageSquare, AlertCircle, Building2 } from "lucide-react";
import { initTheme } from "../store/themeStore";

export default function Login() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  useEffect(() => { initTheme(); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || t("auth.login_error"));
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", { email, password, name, orgName });
      localStorage.setItem("token", data.token);
      const meRes = await api.get("/api/auth/me");
      useAuthStore.setState({ user: meRes.data.user, token: data.token, isAuthenticated: true });
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || t("auth.register_error"));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: "var(--accent)" }}>
            <MessageSquare size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("app.title")}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t("app.subtitle")}</p>
        </div>
        <div className="card !p-6" style={{ boxShadow: "var(--shadow-lg)" }}>
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("auth.email")}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("auth.password")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="********" required />
              </div>
              {error && <div className="flex items-center gap-2 text-sm rounded-lg p-3" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}><AlertCircle size={16} />{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">
                {loading ? t("auth.logging_in") : t("auth.login")}
              </button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => { setMode("register"); setError(""); }} className="text-[12px] text-brand-text hover:underline">
                  {t("auth.create_new_account")}
                </button>
              </div>
              <div className="mt-3 pt-3 border-t text-center" style={{ borderColor: "var(--border-default)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{t("auth.demo_credentials")}</p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Building2 size={12} className="inline mr-1" />{t("auth.orgName")}
                </label>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input" placeholder="Mi Empresa SA" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("auth.yourName")}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Juan Perez" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("auth.email")}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("auth.passwordMin")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="********" required minLength={6} />
              </div>
              {error && <div className="flex items-center gap-2 text-sm rounded-lg p-3" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}><AlertCircle size={16} />{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">
                {loading ? t("auth.creating_account") : t("auth.create_account_start")}
              </button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-[12px] text-brand-text hover:underline">
                  {t("auth.already_have_account")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
