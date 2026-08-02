import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useTranslation } from "react-i18next";
import { Save, Wifi, WifiOff, Plus, Trash2, Check, TestTube, Eye, EyeOff, Play, Bot, Webhook, Copy, RefreshCw, Power, PowerOff, Zap } from "lucide-react";

function N8nSettings() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.get("/api/n8n/workflows").then(({ data }) => { const list = data?.data || data; setWorkflows(Array.isArray(list) ? list : []); }).catch((err: any) => setError(err.response?.data?.error || "n8n no disponible")); }, []);

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-2"><Zap size={20} style={{ color: "var(--accent)" }} /><h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>n8n Automatizacion</h3></div>
        {error ? <div className="p-4 rounded-lg mb-4 text-sm" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}>{error}. Agrega N8N_API_KEY en Dokploy.</div> : null}
        <button onClick={async () => { setImporting(true); try { const { data } = await api.post("/api/n8n/setup", {}); setResult((data.steps || []).map((s: any) => s.step + ": ok").join("\n")); const wf = await api.get("/api/n8n/workflows"); const list = wf.data?.data || wf.data; setWorkflows(Array.isArray(list) ? list : []); } catch (err: any) { setResult("Error: " + (err.response?.data?.error || err.message)); } finally { setImporting(false); } }} disabled={importing || !!error} className="btn-primary disabled:opacity-50">{importing ? "Configurando..." : "Setup Completo en n8n"}</button>
        {result ? <pre className="mt-4 p-3 rounded text-xs whitespace-pre-wrap" style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>{result}</pre> : null}
      </div>
    </div>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
const [activeTab, setActiveTab] = useState<"whatsapp" | "openwa" | "ai" | "bots" | "users" | "customfields" | "webhooks" | "n8n">("whatsapp");

  const tabs = [
    { id: "whatsapp" as const, label: t("settings.tabs.whatsapp") },
    { id: "openwa" as const, label: t("settings.tabs.whatsapp_personal") },
    { id: "ai" as const, label: t("settings.tabs.ai") },
    { id: "bots" as const, label: t("settings.tabs.bots") },
    ...(user?.role === "ADMIN" ? [{ id: "users" as const, label: t("settings.tabs.users") }] : []),
    ...(user?.role === "ADMIN" ? [{ id: "customfields" as const, label: t("settings.tabs.custom_fields") }] : []),
    ...(user?.role === "ADMIN" ? [{ id: "n8n" as const, label: "n8n" }] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b pb-4" style={{ borderColor: "var(--border-default)" }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === tab.id ? "var(--accent-muted)" : "transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-tertiary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "whatsapp" && <WhatsappSettings />}
      {activeTab === "openwa" && <OpenwaSettings />}
      {activeTab === "ai" && <AISettings />}
      {activeTab === "bots" && <BotSettings />}
      {activeTab === "users" && user?.role === "ADMIN" && <UserSettings />}
      {activeTab === "customfields" && user?.role === "ADMIN" && <CustomFieldsSettings />}
      {activeTab === "n8n" && user?.role === "ADMIN" && <N8nSettings />}
    </div>
  );
}
function WhatsappSettings() {
  const [config, setConfig] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "" });
  const [status, setStatus] = useState<any>({ status: "offline", lastPing: null, configured: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [signupCode, setSignupCode] = useState("");
  const [signupResult, setSignupResult] = useState<any>(null);
  const [signingUp, setSigningUp] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  async function fetchStatus() {
    try {
      const { data } = await api.get("/api/whatsapp/config");
      setStatus({ ...data, configured: data.configured, lastPing: data.lastPing });
    } catch {}
  }

  async function handleSave() {
    setSaving(true);
    try { await api.put("/webhook/config", config); fetchStatus(); } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    try { await api.post("/webhook/test"); fetchStatus(); alert("Conexion exitosa!"); }
    catch (e: any) { alert(e.response?.data?.error || "Error de conexion"); }
    finally { setTesting(false); }
  }

  async function handleOAuthComplete() {
    if (!signupCode.trim()) return;
    setSigningUp(true);
    try {
      const { data } = await api.post("/api/whatsapp/complete-signup", { code: signupCode.trim() });
      setSignupResult(data);
      setSignupCode("");
      fetchStatus();
      alert(`Conectado! Numero: ${data.phoneNumber.displayPhoneNumber}`);
    } catch (e: any) {
      alert("Error: " + (e.response?.data?.error || e.message));
    } finally {
      setSigningUp(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar WhatsApp? El bot dejara de responder")) return;
    setDisconnecting(true);
    try { await api.post("/api/whatsapp/disconnect"); fetchStatus(); } finally { setDisconnecting(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status.status === "online" ? <Wifi size={24} style={{ color: "var(--accent)" }} /> : <WifiOff size={24} style={{ color: "var(--danger)" }} />}
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{status.status === "online" ? "En linea" : "Desconectado"}</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {status.phoneNumberId ? `Phone ID: ${status.phoneNumberId}` : "Sin conexion"}
                {status.lastPing && ` · Ultimo ping: ${new Date(status.lastPing).toLocaleString("es")}`}
              </p>
            </div>
          </div>
          <span className={`status-dot ${status.status === "online" ? "status-online" : "status-offline"}`} />
        </div>
        {status.configured && (
          <button onClick={handleDisconnect} disabled={disconnecting} className="btn-ghost text-xs text-danger mt-3 w-full justify-center">
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        )}
      </div>

      {/* ── OAuth Connect with Meta ──────────────────── */}
      {!status.configured && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Conectar con Meta (Embedded Signup)</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Recomendado: tu app de Meta debe tener habilitado "Embedded Signup" en WhatsApp &rarr; Configuration. Despues del dialog de Meta, pega el <code>code</code> aqui.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Authorization Code de Meta</label>
              <textarea
                value={signupCode}
                onChange={(e) => setSignupCode(e.target.value)}
                rows={3}
                className="input font-mono text-[12px]"
                placeholder="pega aqui el code que devuelve el dialog de Facebook Login..."
              />
            </div>
            <button onClick={handleOAuthComplete} disabled={!signupCode.trim() || signingUp} className="btn-primary w-full disabled:opacity-50">
              {signingUp ? "Conectando..." : "Completar Signup"}
            </button>
            {signupResult && (
              <div className="p-3 rounded-md text-[12px]" style={{ background: "var(--success-muted)", color: "var(--success)" }}>
                <p className="font-medium">Conectado a {signupResult.waba?.name}</p>
                <p>Numero: {signupResult.phoneNumber?.displayPhoneNumber}</p>
                <p>Webhook: {signupResult.webhookUrl}</p>
              </div>
            )}
          </div>
          <details className="mt-3">
            <summary className="text-[11.5px] cursor-pointer" style={{ color: "var(--text-3)" }}>Setup manual (avanzado)</summary>
            <div className="mt-3 space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number ID</label>
                <input value={config.phoneNumberId} onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })} className="input" placeholder="Tu Phone Number ID de Meta" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Access Token</label>
                <div className="relative">
                  <input type={showToken ? "text" : "password"} value={config.accessToken} onChange={(e) => setConfig({ ...config, accessToken: e.target.value })} className="input pr-10" placeholder="Tu Access Token de Meta" />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Verify Token</label>
                <input value={config.verifyToken} onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })} className="input" placeholder="Token de verificacion" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50"><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
                <button onClick={handleTest} disabled={testing || !config.phoneNumberId} className="btn-secondary disabled:opacity-50"><TestTube size={16} /> {testing ? "Probando..." : "Probar Conexion"}</button>
              </div>
            </div>
          </details>
        </div>
      )}

      {status.configured && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Configuracion activa</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5">
              <span style={{ color: "var(--text-secondary)" }}>Phone Number ID</span>
              <code style={{ background: "var(--bg-muted)", padding: "2px 6px", borderRadius: 4 }}>{status.phoneNumberId}</code>
            </div>
            <div className="flex justify-between py-1.5">
              <span style={{ color: "var(--text-secondary)" }}>Webhook URL</span>
              <code style={{ background: "var(--bg-muted)", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>{status.webhookUrl}</code>
            </div>
            <div className="flex justify-between py-1.5">
              <span style={{ color: "var(--text-secondary)" }}>Status</span>
              <span className={`status-dot ${status.status === "online" ? "status-online" : "status-offline"}`} />
            </div>
          </div>
          <button onClick={handleTest} disabled={testing} className="btn-secondary w-full justify-center mt-4">
            <TestTube size={14} /> {testing ? "Probando..." : "Probar Conexion"}
          </button>
        </div>
      )}
    </div>
  );
}
function OpenwaSettings() {
  const [config, setConfig] = useState({ baseUrl: "http://openwa:2785", apiKey: "", sessionId: "" });
  const [status, setStatus] = useState<{ status: string; session: any; sessions: any[] } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [webhookMsg, setWebhookMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const isWaiting = status?.status === "initializing" || status?.status === "created" || status?.status === "qr_ready";

  useEffect(() => {
    if (!isWaiting) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [isWaiting]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => { fetchConfig(); }, []);

  async function fetchConfig() {
    try {
      const { data } = await api.get("/api/openwa/config");
      if (data.config) setConfig({ baseUrl: data.config.baseUrl, apiKey: data.config.apiKey, sessionId: data.config.sessionId || "" });
    } catch {}
  }

  async function fetchStatus() {
    try {
      const { data } = await api.get("/api/openwa/status");
      const newStatus = data.session?.status;
      setStatus(data);
      if (!qrCode && newStatus === "qr_ready") {
        try {
          const qr: any = await api.get("/api/openwa/qr");
          setQrCode(qr.data.qrCode || null);
        } catch {}
      } else if (newStatus !== "qr_ready") {
        setQrCode(null);
      }
    } catch {}
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, status?.status === "ready" ? 5000 : 3000);
    return () => clearInterval(interval);
  }, [status?.status]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/api/openwa/config", config);
      fetchConfig();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al guardar config");
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const { data }: any = await api.post("/api/openwa/test", config);
      alert(`Conexion exitosa! Sesiones: ${data.sessions?.length || 0}`);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error de conexion");
    } finally { setTesting(false); }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await api.post("/api/openwa/session/start");
      fetchStatus();
    } catch (e: any) {
      if (e.response?.status === 429) {
        const cd = e.response.data.cooldown || 60;
        setCooldown(cd);
        alert(`Cooldown activo: esperá ${cd}s. ${e.response.data.error}`);
      } else {
        const err = e.response?.data?.error || "Error al iniciar sesion";
        alert(err + "\n\nRevisa la sección Logs para mas detalles.");
      }
    } finally { setStarting(false); }
  }

  async function handleReset() {
    if (!confirm("Esto eliminará TODAS las sesiones whatsapp-panel en OpenWA. Continuar?")) return;
    try {
      const { data }: any = await api.post("/api/openwa/session/reset");
      alert(data.message || "Conexion reseteada");
      setQrCode(null);
      fetchStatus();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al resetear");
    }
  }

  async function handleWebhook() {
    try {
      const { data }: any = await api.post("/api/openwa/webhook/setup");
      setWebhookMsg(data.message);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al configurar webhook");
    }
  }

  const statusColor =
    status?.status === "ready" ? "var(--accent)" :
    status?.status === "authenticating" ? "#3B82F6" :
    status?.status === "initializing" || status?.status === "qr_ready" || status?.status === "created" ? "#F59E0B" :
    "var(--danger)";
  const statusLabel =
    status?.status === "ready" ? "Conectado" :
    status?.status === "created" ? "Creando sesion..." :
    status?.status === "initializing" ? "Inicializando..." :
    status?.status === "qr_ready" ? "Escanear QR" :
    status?.status === "authenticating" ? "Autenticando..." :
    status?.status === "failed" ? "Error" :
    "Desconectado";

  return (
    <div className="max-w-2xl">
      <div className="card mb-4" style={{ borderColor: "#F59E0B", background: "#FEF3C7" }}>
        <p className="text-sm font-medium" style={{ color: "#92400E" }}>
          ⚠ Solo para WhatsApp personal. No usar con WhatsApp Business API. Meta detecta y banea cuentas Business que usan clientes no oficiales.
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: statusColor }} />
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{statusLabel}</p>
              {status?.session && (
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {status.session.name}{status.session.phone ? ` - ${status.session.phone}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn-secondary text-xs px-2 py-1">Reset</button>
            <button onClick={handleWebhook} className="btn-secondary text-xs px-2 py-1">Webhook</button>
            <button onClick={handleStart} disabled={starting || cooldown > 0} className="btn-primary text-xs px-2 py-1 disabled:opacity-50">
              {starting ? "Iniciando..." : cooldown > 0 ? `Esperá ${cooldown}s` : "Conectar"}
            </button>
          </div>
        </div>
      </div>

      {cooldown > 0 && (
        <div className="card mb-4 text-center" style={{ borderColor: "var(--warning-muted)", background: "var(--warning-muted)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--warning)" }}>
            ⏳ Cooldown anti-ban: {cooldown}s restantes
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            WhatsApp banea cuentas que crean sesiones muy rápido. No insistas.
          </p>
        </div>
      )}

      {isWaiting && !qrCode && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {elapsed < 60
                ? `Esperando QR... ${elapsed}s`
                : `Esperando QR... ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
            </span>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Inicializando Chromium</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
            <div className="h-full rounded-full" style={{
              width: `${Math.min((elapsed / 30) * 100, 95)}%`,
              background: "linear-gradient(90deg, var(--accent), var(--accent-hover))",
              transition: "width 1s ease-in-out",
            }} />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
            {elapsed < 10 ? "Iniciando motor WhatsApp..." :
             elapsed < 20 ? "Cargando WhatsApp Web..." :
             "Generando QR para escanear"}
          </p>
        </div>
      )}

      {qrCode && (
        <div className="card mb-6 text-center">
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Escanear QR</h3>
          <p className="text-sm mb-2" style={{ color: "var(--text-tertiary)" }}>
            Abrí WhatsApp en tu teléfono → Menú → Dispositivos vinculados → Vincular dispositivo
          </p>
          {elapsed >= 60 && elapsed < 120 && (
            <p className="text-xs mb-2 font-medium" style={{ color: "var(--danger)" }}>
              El QR expirará en {120 - elapsed}s
            </p>
          )}
          <img src={qrCode} alt="QR Code" className="inline-block" style={{ width: 256, height: 256 }} />
          {elapsed >= 120 && (
            <div className="mt-3">
              <p className="text-sm mb-3" style={{ color: "var(--danger)" }}>
                QR expirado
              </p>
              <button onClick={handleStart} className="btn-primary">
                Generar nuevo QR
              </button>
            </div>
          )}
        </div>
      )}

      {webhookMsg && (
        <div className="card mb-6 text-sm" style={{ borderColor: "var(--accent-muted)" }}>
          <p style={{ color: "var(--accent)" }}>{webhookMsg}</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Conexión OpenWA</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Base URL</label>
            <input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} className="input" placeholder="http://openwa:2785" />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>API Key</label>
            <input type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} className="input" placeholder="owa_k1_..." />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Session ID</label>
            <input value={config.sessionId} onChange={(e) => setConfig({ ...config, sessionId: e.target.value })} className="input" placeholder="UUID de sesión (dejar vacío para crear nueva)" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50"><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
            <button onClick={handleTest} disabled={testing} className="btn-secondary disabled:opacity-50"><TestTube size={16} /> {testing ? "Probando..." : "Probar Conexión"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function AISettings() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", provider: "openai", apiKey: "", model: "", endpoint: "" });
  const [editingId, setEditingId] = useState(null);
  const [testMsg, setTestMsg] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testConfigId, setTestConfigId] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchConfigs(); }, []);

  async function fetchConfigs() {
    try { const { data }: any = await api.get("/api/ai"); setConfigs(data.configs || []); } catch {}
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/ai/${editingId}`, form);
      } else {
        await api.post("/api/ai", form);
      }
      setForm({ name: "", provider: "openai", apiKey: "", model: "", endpoint: "" });
      setEditingId(null);
      fetchConfigs();
    } catch (e: any) { alert(e.response?.data?.error || "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleEdit(c: any) {
    setForm({ name: c.name, provider: c.provider, apiKey: c.apiKey || "", model: c.model, endpoint: c.endpoint || "" });
    setEditingId(c.id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar config?")) return;
    try { await api.delete(`/api/ai/${id}`); fetchConfigs(); } catch {}
  }

  async function handleSetDefault(id: string) {
    try { await api.put(`/api/ai/${id}/default`); fetchConfigs(); } catch {}
  }

  async function handleTest() {
    if (!testConfigId || !testMsg) return;
    setTestLoading(true);
    try {
      const { data }: any = await api.post("/api/ai/test-generate", { configId: testConfigId, messages: [{ role: "user", content: testMsg }] });
      setTestResult(data.response || "Sin respuesta");
    } catch (e: any) { setTestResult("Error: " + (e.response?.data?.error || e.message)); }
    finally { setTestLoading(false); }
  }

  const providers = [
    { value: "opencode", label: "OpenCode Zen" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "custom", label: "Custom Endpoint" },
  ];

  const modelSuggestions: Record<string, string[]> = {
    opencode: ["mimo-2.5-flash", "deepseek-v4-flash", "qwen3-coder-480b", "llama-3.1-70b"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    custom: ["mimo-2.5-flash", "deepseek-v4-flash", "llama-3.1-70b", "gemini-2.0-flash"],
  };

  const endpointSuggestions: Record<string, string> = {
    opencode: "https://api.opencode.ai/v1",
    deepseek: "https://api.deepseek.com/v1",
    custom: "",
  };

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{editingId ? "Editar Config" : "Nueva Config"}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Mi config" />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Proveedor</label>
            <select value={form.provider} onChange={(e) => {
              const p = e.target.value;
              setForm({ ...form, provider: p, endpoint: endpointSuggestions[p] || "", model: "" });
            }}
              className="input" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
              {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>API Key</label>
            <input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="input" placeholder="sk-..." type="password" />
          </div>
          {(form.provider === "custom" || form.provider === "deepseek") && (
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Endpoint URL</label>
              <input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} className="input" placeholder="https://api.deepseek.com/v1" />
            </div>
          )}
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Modelo</label>
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input" placeholder="deepseek-chat" />
            {modelSuggestions[form.provider]?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {modelSuggestions[form.provider].map((m) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, model: m })}
                    className="text-xs px-2 py-1 rounded-full transition-colors"
                    style={{
                      background: form.model === m ? "var(--accent-muted)" : "var(--bg-muted)",
                      color: form.model === m ? "var(--accent)" : "var(--text-secondary)",
                      border: `1px solid ${form.model === m ? "var(--accent)" : "var(--border-default)"}`,
                    }}>
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.name || !form.apiKey || !form.model} className="btn-primary disabled:opacity-50">
              <Save size={16} /> {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
            {editingId && <button onClick={() => { setForm({ name: "", provider: "deepseek", apiKey: "", model: "", endpoint: "" }); setEditingId(null); }} className="btn-secondary">Cancelar</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Configuraciones</h3>
        {configs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Sin configs. Crea una arriba.</p>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <div key={c.id} className="p-3 rounded-lg flex items-center justify-between" style={{ background: "var(--bg-muted)" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                    {c.isDefault && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>default</span>}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{c.provider} - {c.model}</p>
                </div>
                <div className="flex gap-1">
                  {!c.isDefault && <button onClick={() => handleSetDefault(c.id)} className="btn-secondary text-xs px-2 py-1"><Check size={12} /></button>}
                  <button onClick={() => handleEdit(c)} className="btn-secondary text-xs px-2 py-1">Editar</button>
                  <button onClick={() => handleDelete(c.id)} className="btn-secondary text-xs px-2 py-1" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Probar IA</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Config</label>
            <select value={testConfigId} onChange={(e) => setTestConfigId(e.target.value)}
              className="input" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
              <option value="">Seleccionar...</option>
              {configs.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Mensaje</label>
            <textarea value={testMsg} onChange={(e) => setTestMsg(e.target.value)} rows={3} className="input" placeholder="Escribi un mensaje..." />
          </div>
          <button onClick={handleTest} disabled={testLoading || !testConfigId || !testMsg} className="btn-primary disabled:opacity-50">
            {testLoading ? "Generando..." : "Probar"}
          </button>
          {testResult && (
            <div className="p-3 rounded-lg mt-2" style={{ background: "var(--bg-muted)" }}>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{testResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function BotSettings() {
  const [bots, setBots] = useState<any[]>([]);
  const [expandedBot, setExpandedBot] = useState(null);
  const [form, setForm] = useState({ name: "", systemPrompt: "", exactMatch: false, keywords: "" });
  const [keywordInput, setKeywordInput] = useState<Record<string, string>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBots(); }, []);

  async function fetchBots() {
    try { const { data }: any = await api.get("/api/bots"); setBots(data.bots || []); } catch {}
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const kwList = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      await api.post("/api/bots", { name: form.name, systemPrompt: form.systemPrompt || undefined, exactMatch: form.exactMatch, keywords: kwList });
      setForm({ name: "", systemPrompt: "", exactMatch: false, keywords: "" });
      fetchBots();
    } catch (e: any) { alert(e.response?.data?.error || "Error al crear bot"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar bot?")) return;
    try { await api.delete(`/api/bots/${id}`); fetchBots(); } catch {}
  }

  async function handleSetDefault(id: string) {
    try { await api.put(`/api/bots/${id}/default`); fetchBots(); } catch {}
  }

  async function handleToggleActive(bot: any) {
    try { await api.put(`/api/bots/${bot.id}`, { isActive: !bot.isActive }); fetchBots(); } catch {}
  }

  async function handleAddKeyword(botId: string) {
    const kw = keywordInput[botId]?.trim();
    if (!kw) return;
    try {
      await api.post(`/api/bots/${botId}/keywords`, { keyword: kw });
      setKeywordInput({ ...keywordInput, [botId]: "" });
      fetchBots();
    } catch (e: any) { alert(e.response?.data?.error || "Error al agregar keyword"); }
  }

  async function handleRemoveKeyword(botId: string, keywordId: string) {
    try { await api.delete(`/api/bots/${botId}/keywords/${keywordId}`); fetchBots(); } catch {}
  }

  async function handleTest(botId: string) {
    const msg = testMsg[botId] || "Hola";
    setTestLoading({ ...testLoading, [botId]: true });
    try {
      const { data }: any = await api.post(`/api/bots/${botId}/test`, { message: msg });
      setTestResult({ ...testResult, [botId]: data.response || "Sin respuesta" });
    } catch (e: any) { setTestResult({ ...testResult, [botId]: "Error: " + (e.response?.data?.error || e.message) }); }
    finally { setTestLoading({ ...testLoading, [botId]: false }); }
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Nuevo Bot</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Bot de ventas" />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>System Prompt</label>
            <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={3} className="input" placeholder="Sos un vendedor..." />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Keywords (separadas por coma)</label>
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className="input" placeholder="precio, horario, comprar" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="exactMatch" checked={form.exactMatch} onChange={(e) => setForm({ ...form, exactMatch: e.target.checked })} />
            <label htmlFor="exactMatch" className="text-sm" style={{ color: "var(--text-secondary)" }}>Match exacto (default: contiene)</label>
          </div>
          <button onClick={handleCreate} disabled={saving || !form.name} className="btn-primary disabled:opacity-50">
            <Plus size={16} /> {saving ? "Creando..." : "Crear Bot"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Bots</h3>
        {bots.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Sin bots. Crea uno arriba.</p>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div key={bot.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
                <div className="p-3 flex items-center justify-between" style={{ background: "var(--bg-muted)" }}>
                  <div className="flex items-center gap-3">
                    <Bot size={20} style={{ color: "var(--accent)" }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{bot.name}</span>
                        {bot.isDefault && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>default</span>}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {bot.keywords?.length || 0} keywords | {bot._count?.flowSteps || 0} pasos | {bot._count?.conversations || 0} conversaciones
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleToggleActive(bot)} className="btn-secondary text-xs px-2 py-1"
                      style={{ color: bot.isActive ? "var(--accent)" : "var(--text-tertiary)" }}>
                      {bot.isActive ? "Activo" : "Inactivo"}
                    </button>
                    {!bot.isDefault && <button onClick={() => handleSetDefault(bot.id)} className="btn-secondary text-xs px-2 py-1"><Check size={12} /></button>}
                    <button onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)} className="btn-secondary text-xs px-2 py-1">
                      {expandedBot === bot.id ? "Cerrar" : "Editar"}
                    </button>
                    <button onClick={() => handleDelete(bot.id)} className="btn-secondary text-xs px-2 py-1" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                  </div>
                </div>

                {expandedBot === bot.id && (
                  <div className="p-3 space-y-4" style={{ borderTop: "1px solid var(--border-default)" }}>
                    {/* Keywords */}
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Keywords</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {bot.keywords?.map((kw: any) => (
                          <span key={kw.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                            {kw.keyword}
                            <button onClick={() => handleRemoveKeyword(bot.id, kw.id)} className="hover:opacity-70">&times;</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={keywordInput[bot.id] || ""} onChange={(e) => setKeywordInput({ ...keywordInput, [bot.id]: e.target.value })}
                          className="input flex-1 text-sm" placeholder="Nueva keyword..."
                          onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(bot.id)} />
                        <button onClick={() => handleAddKeyword(bot.id)} className="btn-primary text-xs px-2 py-1"><Plus size={12} /></button>
                      </div>
                    </div>

                    {/* Test */}
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Probar Bot</p>
                      <div className="flex gap-2 mb-2">
                        <input value={testMsg[bot.id] || ""} onChange={(e) => setTestMsg({ ...testMsg, [bot.id]: e.target.value })}
                          className="input flex-1 text-sm" placeholder="Mensaje de prueba..." />
                        <button onClick={() => handleTest(bot.id)} disabled={testLoading[bot.id]}
                          className="btn-primary text-xs px-2 py-1 disabled:opacity-50">
                          <Play size={12} /> {testLoading[bot.id] ? "..." : "Probar"}
                        </button>
                      </div>
                      {testResult[bot.id] && (
                        <div className="p-2 rounded text-sm" style={{ background: "var(--bg-muted)" }}>
                          <p className="whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{testResult[bot.id]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function UserSettings() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "AGENT" });

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try { const { data }: any = await api.get("/api/users"); setUsers(data.users || []); } catch {}
  }

  async function handleCreate() {
    try {
      await api.post("/api/users", form);
      setForm({ name: "", email: "", password: "", phone: "", role: "AGENT" });
      fetchUsers();
    } catch (e: any) { alert(e.response?.data?.error || "Error"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar usuario?")) return;
    try { await api.delete(`/api/users/${id}`); fetchUsers(); } catch {}
  }

  async function handleToggleActive(user: any) {
    try { await api.put(`/api/users/${user.id}`, { isActive: !user.isActive }); fetchUsers(); } catch {}
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Nuevo Usuario</h3>
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="Email" type="email" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder="Contrasena" type="password" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="Telefono (opcional)" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
            <option value="AGENT">Agente</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button onClick={handleCreate} disabled={!form.name || !form.email || !form.password} className="btn-primary disabled:opacity-50">
            <Plus size={16} /> Crear Usuario
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Usuarios</h3>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="p-3 rounded-lg flex items-center justify-between" style={{ background: "var(--bg-muted)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{u.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: u.role === "ADMIN" ? "var(--accent-muted)" : "var(--bg-card)", color: "var(--text-secondary)" }}>{u.role}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{u.email}{u.phone ? ` | ${u.phone}` : ""}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleToggleActive(u)} className="btn-secondary text-xs px-2 py-1"
                  style={{ color: u.isActive ? "var(--accent)" : "var(--text-tertiary)" }}>{u.isActive ? "Activo" : "Inactivo"}</button>
                <button onClick={() => handleDelete(u.id)} className="btn-secondary text-xs px-2 py-1" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomFieldsSettings() {
  const [fields, setFields] = useState<any[]>([]);
  const [form, setForm] = useState({ label: "", key: "", type: "text", required: false, active: true });

  useEffect(() => { fetchFields(); }, []);

  async function fetchFields() {
    try { const { data }: any = await api.get("/api/custom-fields"); setFields(data.fields || []); } catch {}
  }

  async function handleCreate() {
    try {
      await api.post("/api/custom-fields", form);
      setForm({ label: "", key: "", type: "text", required: false, active: true });
      fetchFields();
    } catch (e: any) { alert(e.response?.data?.error || "Error"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar campo?")) return;
    try { await api.delete(`/api/custom-fields/${id}`); fetchFields(); } catch {}
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Nuevo Campo</h3>
        <div className="space-y-3">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" placeholder="Label (ej: Numero de documento)" />
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="input" placeholder="Key (ej: documento)" />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="input" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
            <option value="text">Texto</option>
            <option value="number">Numero</option>
            <option value="date">Fecha</option>
            <option value="select">Select</option>
          </select>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cfRequired" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
            <label htmlFor="cfRequired" className="text-sm" style={{ color: "var(--text-secondary)" }}>Requerido</label>
          </div>
          <button onClick={handleCreate} disabled={!form.label || !form.key} className="btn-primary disabled:opacity-50">
            <Plus size={16} /> Crear Campo
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Campos Personalizados</h3>
        {fields.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Sin campos.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.id} className="p-3 rounded-lg flex items-center justify-between" style={{ background: "var(--bg-muted)" }}>
                <div>
                  <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{f.label}</span>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{f.key} ({f.type}){f.required ? " - Requerido" : ""}</p>
                </div>
                  <button onClick={() => handleDelete(f.id)} className="btn-secondary text-xs px-2 py-1" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

}

function WebhookSettings() {
    const { t, i18n } = useTranslation();
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [selectedActions, setSelectedActions] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    const baseUrl = window.location.origin;

    const actions = [
      { key: "create_contact", label: t("settings.webhooks.actions.create_contact") },
      { key: "update_contact", label: t("settings.webhooks.actions.update_contact") },
      { key: "create_deal", label: t("settings.webhooks.actions.create_deal") },
      { key: "move_deal", label: t("settings.webhooks.actions.move_deal") },
      { key: "add_score", label: t("settings.webhooks.actions.add_score") },
      { key: "send_template", label: t("settings.webhooks.actions.send_template") },
      { key: "add_note", label: t("settings.webhooks.actions.add_note") },
      { key: "add_tags", label: t("settings.webhooks.actions.add_tags") },
    ];

    useEffect(() => { fetchConfig(); }, []);

    async function fetchConfig() {
      setLoading(true);
      try {
        const { data } = await api.get("/api/webhooks/config");
        setConfig(data);
        if (data.allowedActions) setSelectedActions(data.allowedActions);
      } catch {} finally { setLoading(false); }
    }

    async function handleToggle() {
      setSaving(true);
      try {
        await api.put("/api/webhooks/config", { isEnabled: !config.isEnabled });
        fetchConfig();
      } finally { setSaving(false); }
    }

    async function handleSaveActions() {
      setSaving(true);
      try {
        await api.put("/api/webhooks/config", { allowedActions: selectedActions });
        fetchConfig();
      } finally { setSaving(false); }
    }

    async function handleRegenerate() {
      if (!confirm("Esto invalidara el secret actual. Continuar?")) return;
      setSaving(true);
      try {
        const { data } = await api.post("/api/webhooks/regenerate-secret");
        setNewSecret(data.secret);
        fetchConfig();
      } finally { setSaving(false); }
    }

    function toggleAction(key: string) {
      setSelectedActions((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    }

    return (
      <div className="max-w-2xl">
        {loading ? (
          <div className="card"><p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{t("common.loading")}</p></div>
        ) : (
          <>
            <div className="card mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Webhook size={24} style={{ color: config?.isEnabled ? "var(--accent)" : "var(--text-tertiary)" }} />
                  <div>
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {config?.configured ? t("settings.webhooks.configured") : t("settings.webhooks.not_configured")}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {config?.isEnabled ? t("settings.webhooks.active") : t("settings.webhooks.disabled")}
                      {config?.lastTriggered && ` · ${t("settings.webhooks.last_trigger")}: ${new Date(config.lastTriggered).toLocaleString(i18n.language === "pt-BR" ? "pt-BR" : "es")}`}
                      {(config?.triggerCount > 0) && ` · ${config.triggerCount} ${t("settings.webhooks.triggers")}`}
                    </p>
                  </div>
                </div>
                {config?.configured && (
                  <button onClick={handleToggle} disabled={saving}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    {config.isEnabled ? <><PowerOff size={14} />{t("settings.webhooks.deactivate")}</> : <><Power size={14} />{t("settings.webhooks.activate")}</>}
                  </button>
                )}
              </div>
            </div>

            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("settings.webhooks.secret_key")}</h3>
              {newSecret ? (
                <div className="p-4 rounded-lg mb-4" style={{ border: "2px solid var(--accent)", background: "var(--accent-muted)" }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>{t("settings.webhooks.new_secret")}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 rounded text-[11px] break-all" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>{newSecret}</code>
                    <button onClick={() => { navigator.clipboard.writeText(newSecret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="btn-secondary px-2 py-1.5">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--warning)" }}>{t("settings.webhooks.secret_warning")}</p>
                </div>
              ) : config?.configured ? (
                <div className="flex gap-2 mb-4">
                  <button onClick={handleRegenerate} disabled={saving}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <RefreshCw size={14} /> {saving ? t("settings.webhooks.generating") : t("settings.webhooks.regenerate")}
                  </button>
                </div>
              ) : (
                <button onClick={handleRegenerate} disabled={saving}
                  className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Plus size={16} /> {t("settings.webhooks.generate")}
                </button>
              )}
            </div>

            {config?.configured && (
              <div className="card mb-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("settings.webhooks.allowed_actions")}</h3>
                <div className="space-y-2 mb-4">
                  {actions.map((a) => (
                    <label key={a.key} className="flex items-center gap-2 p-2 rounded cursor-pointer" style={{ background: "var(--bg-muted)" }}>
                      <input type="checkbox" checked={selectedActions.includes(a.key)} onChange={() => toggleAction(a.key)} />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{a.label}</span>
                      <code className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>{a.key}</code>
                    </label>
                  ))}
                </div>
                <button onClick={handleSaveActions} disabled={saving || selectedActions.length === 0}
                  className="btn-primary disabled:opacity-50">
                  <Save size={16} /> {t("common.save")} {t("common.actions")}
                </button>
              </div>
            )}

            <div className="card">
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("settings.webhooks.how_to")}</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("settings.webhooks.url_label")}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 rounded text-[11px] break-all" style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
                      {baseUrl}/api/webhooks/trigger
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/api/webhooks/trigger`); }}
                      className="btn-secondary px-2 py-1.5"><Copy size={14} /></button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("settings.webhooks.body_format")}</p>
                  <pre className="p-3 rounded text-[11px] leading-relaxed overflow-x-auto" style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
{`{
  "orgId": "TU_ORG_ID",
  "secret": "wh_...",
  "action": "create_deal",
  "payload": {
    "contactPhone": "595981234567",
    "title": "Nuevo deal desde formulario",
    "value": 1500,
    "priority": "HIGH"
  }
}`}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("settings.webhooks.n8n_step")}</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--text-tertiary)" }}>
                    <li>Method: POST</li>
                    <li>URL: {baseUrl}/api/webhooks/trigger</li>
                    <li>Headers: Content-Type: application/json</li>
                    <li>Body: JSON con orgId, secret, action, payload</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
