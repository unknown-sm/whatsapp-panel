import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Save, Wifi, WifiOff, Plus, Trash2, Check, TestTube, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "ai" | "users" | "customfields">("whatsapp");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Configuracion</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--border-default)] pb-4">
        {[
          { id: "whatsapp" as const, label: "WhatsApp" },
          { id: "ai" as const, label: "Inteligencia Artificial" },
          ...(user?.role === "ADMIN" ? [{ id: "users" as const, label: "Usuarios" }] : []),
          ...(user?.role === "ADMIN" ? [{ id: "customfields" as const, label: "Campos Personalizados" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "whatsapp" && <WhatsappSettings />}
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

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const { data } = await api.get("/webhook/status");
      setStatus(data);
      if (data.configured) {
        setConfig({ phoneNumberId: "", accessToken: "", verifyToken: "" });
      }
    } catch {}
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/webhook/config", config);
      fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await api.post("/webhook/test");
      fetchStatus();
      alert("Conexion exitosa!");
    } catch (e: any) {
      alert(e.response?.data?.error || "Error de conexion");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Status */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status.status === "online" ? (
              <Wifi className="text-[var(--accent)]" size={24} />
            ) : (
              <WifiOff className="text-red-500" size={24} />
            )}
            <div>
              <p className="text-[var(--text-primary)] font-medium">
                {status.status === "online" ? "En linea" : "Desconectado"}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {status.lastPing ? `Ultimo ping: ${new Date(status.lastPing).toLocaleString("es")}` : "Sin conexion"}
              </p>
            </div>
          </div>
          <span className={`status-dot ${status.status === "online" ? "status-online" : "status-offline"}`} />
        </div>
      </div>

      {/* Config form */}
      <div className="card">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Meta Cloud API</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Phone Number ID</label>
            <input
              value={config.phoneNumberId}
              onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
              className="input w-full"
              placeholder="Tu Phone Number ID de Meta"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Access Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={config.accessToken}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                className="input w-full pr-10"
                placeholder="Tu Access Token de Meta"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Verify Token</label>
            <input
              value={config.verifyToken}
              onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })}
              className="input w-full"
              placeholder="Token de verificacion (inventalo)"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={handleTest} disabled={testing || !config.phoneNumberId} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
              <TestTube size={16} /> {testing ? "Probando..." : "Probar Conexion"}
            </button>
          </div>
        </div>

        {/* Webhook URL info */}
        <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
          <p className="text-sm text-[var(--text-tertiary)] mb-2">URL del Webhook:</p>
          <code className="bg-[var(--bg-elevated)] text-[var(--accent)] px-3 py-1.5 rounded text-sm block">
            {window.location.origin}/webhook/incoming
          </code>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Configura esta URL en tu app de Meta Developers → WhatsApp → Configuration → Callback URL
          </p>
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
    try {
      const { data } = await api.get("/api/ai");
      setConfigs(data.configs);
    } catch {}
  }

  async function handleCreate() {
    if (!newConfig.name || !newConfig.apiKey || !newConfig.model) return;
    setSaving(true);
    try {
      await api.post("/api/ai", newConfig);
      setNewConfig({ name: "", provider: "openai", apiKey: "", model: "", endpoint: "" });
      setShowCreate(false);
      fetchConfigs();
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    await api.put(`/api/ai/${id}/default`);
    fetchConfigs();
  }

  async function handleDelete(id: string) {
    if (confirm("¿Eliminar esta config?")) {
      await api.delete(`/api/ai/${id}`);
      fetchConfigs();
    }
  }

  const providerLabels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    custom: "Custom",
  };

  const modelSuggestions: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-sonnet-4-6", "claude-3-5-sonnet-latest", "claude-3-haiku-latest"],
    custom: [],
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[var(--text-tertiary)] text-sm">Configura los proveedores de IA para tus bots</p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Agregar IA
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6 border-accent-600/30">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Nueva configuracion de IA</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre</label>
                <input value={newConfig.name} onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })} className="input w-full" placeholder="ej: OpenAI GPT-4o" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Proveedor</label>
                <select value={newConfig.provider} onChange={(e) => setNewConfig({ ...newConfig, provider: e.target.value })} className="input w-full">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom Endpoint</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
              <input type="password" value={newConfig.apiKey} onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })} className="input w-full" placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Modelo</label>
              <input value={newConfig.model} onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })} className="input w-full" placeholder={newConfig.provider === "openai" ? "gpt-4o" : "claude-sonnet-4-6"} />
              {modelSuggestions[newConfig.provider]?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {modelSuggestions[newConfig.provider].map((m) => (
                    <button key={m} onClick={() => setNewConfig({ ...newConfig, model: m })} className="text-xs px-2 py-1 rounded bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {newConfig.provider === "custom" && (
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Endpoint URL</label>
                <input value={newConfig.endpoint} onChange={(e) => setNewConfig({ ...newConfig, endpoint: e.target.value })} className="input w-full" placeholder="https://tu-api.com/v1/chat" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving || !newConfig.name || !newConfig.apiKey || !newConfig.model} className="btn-primary disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-tertiary)]">No hay configuraciones de IA. ¡Agrega la primera!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className={`card ${cfg.isDefault ? "border-accent-600/50" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-primary)] font-medium">{cfg.name}</span>
                    {cfg.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-muted)] text-[var(--accent)] flex items-center gap-1">
                        <Check size={12} /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)]">{providerLabels[cfg.provider]} — {cfg.model}</p>
                  {cfg.endpoint && <p className="text-xs text-[var(--text-tertiary)] mt-1">{cfg.endpoint}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!cfg.isDefault && (
                    <button onClick={() => handleSetDefault(cfg.id)} className="text-xs px-2 py-1 rounded bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                      Setear default
                    </button>
                  )}
                  <button onClick={() => handleDelete(cfg.id)} className="p-1.5 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400">
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[var(--text-tertiary)] text-sm">Gestiona los usuarios del panel</p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6 border-accent-600/30">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Nuevo usuario</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Nombre</label>
                <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="input w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Contrasena</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Rol</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="input w-full">
                  <option value="AGENT">Agente</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Creando..." : "Crear Usuario"}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="card text-center py-12">
        <p className="text-[var(--text-tertiary)]">Funcionalidad de gestion de usuarios en desarrollo</p>
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
    try {
      const res = await api.get("/customfields");
      setFields(res.data);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => { fetchFields(); }, []);

  async function handleCreate() {
    if (!newField.name.trim()) return;
    setLoading(true);
    try {
      await api.post("/customfields", {
        name: newField.name.trim(),
        fieldType: newField.fieldType,
        entityType: newField.entityType,
        options: newField.options.split(",").map((o) => o.trim()).filter(Boolean),
      });
      setNewField({ name: "", fieldType: "TEXT", entityType: "CONTACT", options: "" });
      setShowCreate(false);
      fetchFields();
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este campo?")) return;
    try {
      await api.delete(`/customfields/${id}`);
      fetchFields();
    } catch (e) {
      // ignore
    }
  }

  const typeLabels: Record<string, string> = {
    TEXT: "Texto",
    NUMBER: "Numero",
    DATE: "Fecha",
    SELECT: "Seleccion",
    BOOLEAN: "Si/No",
  };

  const entityLabels: Record<string, string> = {
    CONTACT: "Contacto",
    DEAL: "Deal",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Campos Personalizados</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Nuevo Campo
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4" style={{ border: "1px solid var(--border-default)" }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Nombre</label>
              <input type="text" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} className="input" placeholder="Ej: Empresa" />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</label>
              <select value={newField.fieldType} onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })} className="input">
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Entidad</label>
              <select value={newField.entityType} onChange={(e) => setNewField({ ...newField, entityType: e.target.value })} className="input">
                {Object.entries(entityLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
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
        <div className="card p-8 text-center" style={{ border: "1px solid var(--border-default)" }}>
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
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {typeLabels[field.fieldType]} • {entityLabels[field.entityType]} • {field._count?.values || 0} valores
                  </div>
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
