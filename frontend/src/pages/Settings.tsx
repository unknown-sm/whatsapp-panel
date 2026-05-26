import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Save, Wifi, WifiOff, Plus, Trash2, Check, TestTube, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "openwa" | "ai" | "users" | "customfields">("whatsapp");

  const tabs = [
    { id: "whatsapp" as const, label: "WhatsApp" },
    { id: "openwa" as const, label: "OpenWA" },
    { id: "ai" as const, label: "Inteligencia Artificial" },
    ...(user?.role === "ADMIN" ? [{ id: "users" as const, label: "Usuarios" }] : []),
    ...(user?.role === "ADMIN" ? [{ id: "customfields" as const, label: "Campos Personalizados" }] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configuracion</h1>
          <p>Administra las conexiones y preferencias del sistema</p>
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
      {activeTab === "users" && user?.role === "ADMIN" && <UserSettings />}
      {activeTab === "customfields" && user?.role === "ADMIN" && <CustomFieldsSettings />}
    </div>
  );
}

function WhatsappSettings() {
  const [config, setConfig] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "" });
  const [status, setStatus] = useState({ status: "offline", lastPing: null, configured: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  async function fetchStatus() {
    try { const { data } = await api.get("/webhook/status"); setStatus(data); if (data.configured) setConfig({ phoneNumberId: "", accessToken: "", verifyToken: "" }); } catch {}
  }

  async function handleSave() { setSaving(true); try { await api.put("/webhook/config", config); fetchStatus(); } finally { setSaving(false); } }

  async function handleTest() {
    setTesting(true);
    try { await api.post("/webhook/test"); fetchStatus(); alert("Conexion exitosa!"); }
    catch (e: any) { alert(e.response?.data?.error || "Error de conexion"); }
    finally { setTesting(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status.status === "online" ? <Wifi size={24} style={{ color: "var(--accent)" }} /> : <WifiOff size={24} style={{ color: "var(--danger)" }} />}
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{status.status === "online" ? "En linea" : "Desconectado"}</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{status.lastPing ? `Ultimo ping: ${new Date(status.lastPing).toLocaleString("es")}` : "Sin conexion"}</p>
            </div>
          </div>
          <span className={`status-dot ${status.status === "online" ? "status-online" : "status-offline"}`} />
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Meta Cloud API</h3>
        <div className="space-y-4">
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
            <input value={config.verifyToken} onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })} className="input" placeholder="Token de verificacion (inventalo)" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50"><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
            <button onClick={handleTest} disabled={testing || !config.phoneNumberId} className="btn-secondary disabled:opacity-50"><TestTube size={16} /> {testing ? "Probando..." : "Probar Conexion"}</button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
          <p className="text-sm mb-2" style={{ color: "var(--text-tertiary)" }}>URL del Webhook:</p>
          <code className="px-3 py-1.5 rounded text-sm block" style={{ background: "var(--bg-muted)", color: "var(--accent)" }}>
            {window.location.origin}/webhook/incoming
          </code>
          <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
            Configura esta URL en tu app de Meta Developers &rarr; WhatsApp &rarr; Configuration &rarr; Callback URL
          </p>
        </div>
      </div>
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
  const [webhookMsg, setWebhookMsg] = useState("");

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
      setStatus(data);
      if (data.session?.status === "initializing" || data.session?.status === "SCAN_QR") {
        const qr = await api.get("/api/openwa/qr");
        setQrCode(qr.data.qrCode || null);
      } else {
        setQrCode(null);
      }
    } catch {}
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSave() {
    setSaving(true);
    try { await api.put("/api/openwa/config", config); fetchConfig(); } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const { data } = await api.post("/api/openwa/test", config);
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
      alert(e.response?.data?.error || "Error al iniciar sesion");
    } finally { setStarting(false); }
  }

  async function handleWebhook() {
    try {
      const { data } = await api.post("/api/openwa/webhook/setup");
      setWebhookMsg(data.message);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al configurar webhook");
    }
  }

  const statusColor = status?.status === "connected" ? "var(--accent)" : status?.status === "initializing" || status?.status === "SCAN_QR" ? "#F59E0B" : "var(--danger)";
  const statusLabel = status?.status === "connected" ? "Conectado" : status?.status === "initializing" ? "Inicializando" : status?.status === "SCAN_QR" ? "Esperando QR" : status?.status === "error" ? "Error" : "Desconectado";

  return (
    <div className="max-w-2xl">
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
            <button onClick={handleWebhook} className="btn-secondary text-xs px-2 py-1">Webhook</button>
            <button onClick={handleStart} disabled={starting} className="btn-primary text-xs px-2 py-1 disabled:opacity-50">
              {starting ? "Iniciando..." : "Conectar"}
            </button>
          </div>
        </div>
      </div>

      {qrCode && (
        <div className="card mb-6 text-center">
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Escanear QR</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-tertiary)" }}>
            Abre WhatsApp en tu telefono &rarr; Men &rarr; Dispositivos vinculados &rarr; Vincular dispositivo
          </p>
          <img src={qrCode} alt="QR Code" className="inline-block" style={{ width: 256, height: 256 }} />
        </div>
      )}

      {webhookMsg && (
        <div className="card mb-6 text-sm" style={{ borderColor: "var(--accent-muted)" }}>
          <p style={{ color: "var(--accent)" }}>{webhookMsg}</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Conexion OpenWA</h3>
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
            <input value={config.sessionId} onChange={(e) => setConfig({ ...config, sessionId: e.target.value })} className="input" placeholder="UUID de sesion (dejar vacio para crear nueva)" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50"><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button>
            <button onClick={handleTest} disabled={testing || !config.apiKey} className="btn-secondary disabled:opacity-50"><TestTube size={16} /> {testing ? "Probando..." : "Probar Conexion"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AISettings() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: "", provider: "openai", apiKey: "", model: "", endpoint: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchConfigs(); }, []);

  async function fetchConfigs() {
    try { const { data } = await api.get("/api/ai"); setConfigs(data.configs); } catch {}
  }

  async function handleCreate() {
    if (!newConfig.name || !newConfig.apiKey || !newConfig.model) return;
    setSaving(true);
    try {
      await api.post("/api/ai", newConfig);
      setNewConfig({ name: "", provider: "openai", apiKey: "", model: "", endpoint: "" });
      setShowCreate(false);
      fetchConfigs();
    } finally { setSaving(false); }
  }

  async function handleSetDefault(id: string) { await api.put(`/api/ai/${id}/default`); fetchConfigs(); }
  async function handleDelete(id: string) { if (confirm("Eliminar esta config?")) { await api.delete(`/api/ai/${id}`); fetchConfigs(); } }

  const providerLabels: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic", custom: "Custom" };
  const modelSuggestions: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-sonnet-4-6", "claude-3-5-sonnet-latest", "claude-3-haiku-latest"],
    custom: [],
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Configura los proveedores de IA para tus bots</p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary"><Plus size={18} /> Agregar IA</button>
      </div>

      {showCreate && (
        <div className="card mb-6" style={{ borderColor: "var(--accent-muted)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Nueva configuracion de IA</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                <input value={newConfig.name} onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })} className="input" placeholder="ej: OpenAI GPT-4o" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Proveedor</label>
                <select value={newConfig.provider} onChange={(e) => setNewConfig({ ...newConfig, provider: e.target.value })} className="input">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom Endpoint</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>API Key</label>
              <input type="password" value={newConfig.apiKey} onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })} className="input" placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Modelo</label>
              <input value={newConfig.model} onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })} className="input" placeholder={newConfig.provider === "openai" ? "gpt-4o" : "claude-sonnet-4-6"} />
              {modelSuggestions[newConfig.provider]?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {modelSuggestions[newConfig.provider].map((m) => (
                    <button key={m} onClick={() => setNewConfig({ ...newConfig, model: m })} className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {newConfig.provider === "custom" && (
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Endpoint URL</label>
                <input value={newConfig.endpoint} onChange={(e) => setNewConfig({ ...newConfig, endpoint: e.target.value })} className="input" placeholder="https://tu-api.com/v1/chat" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving || !newConfig.name || !newConfig.apiKey || !newConfig.model} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <div className="card text-center py-12">
          <p style={{ color: "var(--text-tertiary)" }}>No hay configuraciones de IA. Agrega la primera!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className="card" style={cfg.isDefault ? { borderColor: "var(--accent-muted)" } : {}}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{cfg.name}</span>
                    {cfg.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                        <Check size={12} /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{providerLabels[cfg.provider]} &mdash; {cfg.model}</p>
                  {cfg.endpoint && <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{cfg.endpoint}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!cfg.isDefault && (
                    <button onClick={() => handleSetDefault(cfg.id)} className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                      Setear default
                    </button>
                  )}
                  <button onClick={() => handleDelete(cfg.id)} className="p-1.5 rounded" style={{ color: "var(--text-tertiary)" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserSettings() {
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", role: "AGENT" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newUser.email || !newUser.password) return;
    setSaving(true);
    try {
      await api.post("/api/auth/register", newUser);
      setNewUser({ email: "", password: "", name: "", role: "AGENT" });
      setShowCreate(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Gestiona los usuarios del panel</p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary"><Plus size={18} /> Nuevo Usuario</button>
      </div>

      {showCreate && (
        <div className="card mb-6" style={{ borderColor: "var(--accent-muted)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Nuevo usuario</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
                <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Contrasena</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Rol</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="input">
                  <option value="AGENT">Agente</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Creando..." : "Crear Usuario"}</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="card text-center py-12">
        <p style={{ color: "var(--text-tertiary)" }}>Funcionalidad de gestion de usuarios en desarrollo</p>
      </div>
    </div>
  );
}

function CustomFieldsSettings() {
  const [fields, setFields] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newField, setNewField] = useState({ name: "", fieldType: "TEXT", entityType: "CONTACT", options: "" });
  const [loading, setLoading] = useState(false);

  async function fetchFields() {
    try { const res = await api.get("/api/customfields"); setFields(res.data); } catch {}
  }

  useEffect(() => { fetchFields(); }, []);

  async function handleCreate() {
    if (!newField.name.trim()) return;
    setLoading(true);
    try {
      await api.post("/api/customfields", { name: newField.name.trim(), fieldType: newField.fieldType, entityType: newField.entityType, options: newField.options.split(",").map((o) => o.trim()).filter(Boolean) });
      setNewField({ name: "", fieldType: "TEXT", entityType: "CONTACT", options: "" });
      setShowCreate(false);
      fetchFields();
    } catch {} finally { setLoading(false); }
  }

  async function handleDelete(id: string) { if (!confirm("Eliminar este campo?")) return; try { await api.delete(`/api/customfields/${id}`); fetchFields(); } catch {} }

  const typeLabels: Record<string, string> = { TEXT: "Texto", NUMBER: "Numero", DATE: "Fecha", SELECT: "Seleccion", BOOLEAN: "Si/No" };
  const entityLabels: Record<string, string> = { CONTACT: "Contacto", DEAL: "Deal" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Campos Personalizados</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> Nuevo Campo</button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
              <input type="text" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} className="input" placeholder="Ej: Empresa" />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</label>
              <select value={newField.fieldType} onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })} className="input">
                {Object.entries(typeLabels).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Entidad</label>
              <select value={newField.entityType} onChange={(e) => setNewField({ ...newField, entityType: e.target.value })} className="input">
                {Object.entries(entityLabels).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
              </select>
            </div>
            {newField.fieldType === "SELECT" && (
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Opciones (separadas por coma)</label>
                <input type="text" value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} className="input" placeholder="Opcion 1, Opcion 2" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={loading} className="btn-primary disabled:opacity-50">{loading ? "Creando..." : "Crear"}</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="card p-8 text-center">
          <p style={{ color: "var(--text-tertiary)" }}>No hay campos personalizados configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-hover)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>{typeLabels[field.fieldType]?.[0]}</span>
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{field.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{typeLabels[field.fieldType]} &bull; {entityLabels[field.entityType]} &bull; {field._count?.values || 0} valores</div>
                </div>
              </div>
              <button onClick={() => handleDelete(field.id)} className="p-1.5 rounded transition-colors" style={{ color: "var(--text-tertiary)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
