import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBotStore } from "../store/botStore";
import api from "../services/api";
import {
  ArrowLeft, Trash2, GripVertical, MessageSquare, Bot, Globe,
  Brain, Volume2, Calendar, Share2, FileText, Clock, Eye, Save,
  X, ChevronDown, Image as ImageIcon,
} from "lucide-react";

const STEP_TYPES = [
  { value: "TEXT", label: "Texto", icon: MessageSquare, desc: "Mensaje de texto plano" },
  { value: "AI_AGENT", label: "Agente de IA", icon: Brain, desc: "Respuesta con IA personalizada" },
  { value: "HTTP_REQUEST", label: "Peticion HTTP", icon: Globe, desc: "Llamada a API externa" },
  { value: "INTENT", label: "Reconocimiento de Intencion", icon: Brain, desc: "Detectar intencion del usuario" },
  { value: "SILENCE", label: "Silenciar", icon: Clock, desc: "Pausar bot por N minutos" },
  { value: "CALENDAR", label: "Calendario", icon: Calendar, desc: "Reservar citas" },
  { value: "VOICE_AI", label: "IA de Voz", icon: Volume2, desc: "Transcribir notas de voz" },
  { value: "STRUCTURED_OUTPUT", label: "Salida Estructurada", icon: FileText, desc: "Extraer datos estructurados" },
  { value: "FORWARD", label: "Reenviar Mensaje", icon: Share2, desc: "Enviar a otro bot o flujo" },
];

const RESPONSE_TYPES = [
  { value: "FREE_TEXT", label: "Texto libre" },
  { value: "BUTTONS", label: "Botones" },
  { value: "YES_NO", label: "Si / No" },
  { value: "NONE", label: "Sin respuesta" },
];

interface FlowStep {
  id: string;
  order: number;
  stepType: string;
  message: string | null;
  waitSeconds: number;
  responseType: string | null;
  responseCapture: string | null;
  config: any;
  media: any;
  intentRoutes: any[];
  httpRoutes: any;
}

export default function BotEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { bots, fetchBots, updateBot } = useBotStore();
  const bot = bots.find((b) => b.id === id);

  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<FlowStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    fetchBotData();
  }, [id]);

  const fetchBotData = async () => {
    setLoading(true);
    try {
      await fetchBots();
      const { data } = await api.get(`/api/bots/${id}/steps`);
      setSteps(data.steps);
      if (data.steps.length > 0) setSelectedStep(data.steps[0]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStep(type: string) {
    const { data } = await api.post(`/api/bots/${id}/steps`, {
      stepType: type,
      order: steps.length,
      message: type === "TEXT" ? "" : undefined,
      waitSeconds: 0,
      responseType: "NONE",
    });
    setSteps([...steps, data.step]);
    setSelectedStep(data.step);
  }

  async function handleUpdateStep(stepId: string, updates: any) {
    const { data } = await api.put(`/api/bots/${id}/steps/${stepId}`, updates);
    setSteps(steps.map((s) => (s.id === stepId ? data.step : s)));
    setSelectedStep(data.step);
  }

  async function handleDeleteStep(stepId: string) {
    await api.delete(`/api/bots/${id}/steps/${stepId}`);
    const newSteps = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i }));
    setSteps(newSteps);
    if (selectedStep?.id === stepId) {
      setSelectedStep(newSteps[0] || null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post(`/api/bots/${id}/steps/reorder`, { stepIds: steps.map((s) => s.id) });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddKeyword() {
    if (!newKeyword.trim() || !bot) return;
    await api.post(`/api/bots/${bot.id}/keywords`, { keyword: newKeyword.trim() });
    setNewKeyword("");
    fetchBots();
  }

  async function handleRemoveKeyword(kwId: string) {
    if (!bot) return;
    await api.delete(`/api/bots/${bot.id}/keywords/${kwId}`);
    fetchBots();
  }

  if (loading) { return <div className="p-6" style={{ color: "var(--text-tertiary)" }}>Cargando...</div>; }
  if (!bot) { return <div className="p-6" style={{ color: "var(--text-tertiary)" }}>Bot no encontrado</div>; }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6" style={{ background: "var(--bg-base)" }}>
      {/* Left Panel - Bot Config */}
      <div className="w-72 flex flex-col overflow-y-auto flex-shrink-0" style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <button onClick={() => navigate("/bots")} className="flex items-center gap-2 text-sm mb-3 transition-colors" style={{ color: "var(--text-tertiary)" }}>
            <ArrowLeft size={16} /> <span className="hover:underline">Volver a bots</span>
          </button>
          <input
            value={bot.name}
            onChange={(e) => updateBot(bot.id, { name: e.target.value })}
            className="input w-full font-semibold text-base"
          />
        </div>

        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <h4 className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Keywords</h4>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {bot.keywords.map((kw) => (
              <span key={kw.id} className="pill text-xs">
                {kw.keyword}
                <button onClick={() => handleRemoveKeyword(kw.id)} className="ml-0.5 hover:text-[var(--danger)] transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              className="input flex-1 text-xs py-1.5"
              placeholder="Agregar keyword..."
            />
          </div>
        </div>

        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Coincidencia exacta</span>
            <button
              onClick={() => updateBot(bot.id, { exactMatch: !bot.exactMatch })}
              className={`relative w-9 h-5 rounded-full transition-colors ${bot.exactMatch ? "bg-[var(--accent)]" : "bg-[var(--bg-active)]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${bot.exactMatch ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {bot.exactMatch ? "El mensaje debe coincidir exactamente" : "Busca keywords dentro del mensaje"}
          </p>
        </div>

        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>System Prompt (IA)</label>
          <textarea
            value={bot.systemPrompt || ""}
            onChange={(e) => updateBot(bot.id, { systemPrompt: e.target.value || null })}
            className="input resize-none text-xs"
            rows={4}
            placeholder="Instrucciones para el Agente de IA..."
          />
        </div>

        <div className="p-4 flex-1">
          <h4 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Agregar bloque</h4>
          <div className="space-y-1">
            {STEP_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleAddStep(type.value)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                style={{ color: "var(--text-primary)" }}
              >
                <type.icon size={16} style={{ color: "var(--text-tertiary)" }} />
                <div>
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{type.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: "var(--border-default)" }}>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center disabled:opacity-50">
            <Save size={16} /> {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Center Panel - Steps */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Compositor de mensajes</h2>
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{steps.length} paso{steps.length !== 1 ? "s" : ""}</span>
        </div>

        {steps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} style={{ color: "var(--text-tertiary)", opacity: 0.3 }} className="mx-auto mb-4" />
              <p style={{ color: "var(--text-tertiary)" }}>Agrega bloques desde el panel izquierdo</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isSelected={selectedStep?.id === step.id}
                onSelect={() => setSelectedStep(step)}
                onUpdate={(updates) => handleUpdateStep(step.id, updates)}
                onDelete={() => handleDeleteStep(step.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - WhatsApp Preview */}
      <div className="w-80 flex flex-col flex-shrink-0" style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)" }}>
        <div className="p-4 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <Eye size={18} style={{ color: "var(--text-tertiary)" }} />
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Vista previa WhatsApp</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ background: "#0b141a" }}>
          <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--accent)" }}>
              {bot.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{bot.name}</p>
              <p className="text-xs" style={{ color: "var(--accent)" }}>en linea</p>
            </div>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div key={step.id}>
                <div className="bubble-out mb-1">
                  {step.stepType === "TEXT" && step.message && (
                    <p className="text-sm whitespace-pre-wrap">{step.message}</p>
                  )}
                  {step.stepType === "AI_AGENT" && (
                    <div className="flex items-center gap-2"><Bot size={14} /><p className="text-sm">Agente de IA activo</p></div>
                  )}
                  {step.stepType === "HTTP_REQUEST" && (
                    <div className="flex items-center gap-2"><Globe size={14} /><p className="text-sm">Peticion HTTP</p></div>
                  )}
                  {step.stepType === "SILENCE" && (
                    <div className="flex items-center gap-2"><Clock size={14} /><p className="text-sm">Silenciado {step.waitSeconds}s</p></div>
                  )}
                  {step.stepType === "INTENT" && (
                    <div className="flex items-center gap-2"><Brain size={14} /><p className="text-sm">Deteccion de intencion</p></div>
                  )}
                  {step.stepType === "VOICE_AI" && (
                    <div className="flex items-center gap-2"><Volume2 size={14} /><p className="text-sm">Transcripcion de voz</p></div>
                  )}
                  {!step.message && !["TEXT", "AI_AGENT", "HTTP_REQUEST", "SILENCE", "INTENT", "VOICE_AI"].includes(step.stepType) && (
                    <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.7)" }}>{STEP_TYPES.find((t) => t.value === step.stepType)?.label}</p>
                  )}
                </div>
                {step.waitSeconds > 0 && (
                  <div className="flex items-center gap-1 text-xs mx-2 mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <Clock size={10} /> Espera {step.waitSeconds}s
                  </div>
                )}
                {step.responseType && step.responseType !== "NONE" && (
                  <div className="text-center my-2">
                    <span className="text-xs italic" style={{ color: "rgba(255,255,255,0.4)" }}>...esperamos respuesta</span>
                  </div>
                )}
              </div>
            ))}
            {steps.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Agrega pasos para ver la vista previa</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, index, isSelected, onSelect, onUpdate, onDelete }: {
  step: FlowStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: any) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const typeInfo = STEP_TYPES.find((t) => t.value === step.stepType);

  return (
    <div
      className={`card cursor-pointer transition-all ${isSelected ? "!border-[var(--accent)]" : ""}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 mb-3">
        <GripVertical size={16} style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>#{index + 1}</span>
        {typeInfo && <typeInfo.icon size={16} style={{ color: "var(--accent)" }} />}
        <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{typeInfo?.label}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-icon !w-7 !h-7 hover:!bg-red-500/20 hover:!text-red-400">
          <Trash2 size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="btn-icon !w-7 !h-7">
          <ChevronDown size={12} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {step.stepType === "TEXT" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Mensaje</label>
              <textarea
                value={step.message || ""}
                onChange={(e) => onUpdate({ message: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="input w-full text-sm min-h-[80px] resize-y"
                placeholder="Escribe el mensaje..."
              />
            </div>
          )}

          {step.stepType === "AI_AGENT" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>System Prompt</label>
              <textarea
                value={step.config?.systemPrompt || ""}
                onChange={(e) => onUpdate({ config: { ...step.config, systemPrompt: e.target.value } })}
                onClick={(e) => e.stopPropagation()}
                className="input w-full text-sm min-h-[80px] resize-y"
                placeholder="Define la personalidad del agente..."
              />
              <label className="block text-xs mb-1 mt-2" style={{ color: "var(--text-tertiary)" }}>Max turnos antes de escalar</label>
              <input
                type="number"
                value={step.config?.maxTurns || 5}
                onChange={(e) => onUpdate({ config: { ...step.config, maxTurns: parseInt(e.target.value) } })}
                onClick={(e) => e.stopPropagation()}
                className="input w-full text-sm"
              />
            </div>
          )}

          {step.stepType === "HTTP_REQUEST" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={step.config?.method || "GET"}
                  onChange={(e) => onUpdate({ config: { ...step.config, method: e.target.value } })}
                  onClick={(e) => e.stopPropagation()}
                  className="input text-sm w-24"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  value={step.config?.url || ""}
                  onChange={(e) => onUpdate({ config: { ...step.config, url: e.target.value } })}
                  onClick={(e) => e.stopPropagation()}
                  className="input flex-1 text-sm"
                  placeholder="https://api.ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Headers (JSON)</label>
                <textarea
                  value={JSON.stringify(step.config?.headers || {}, null, 2)}
                  onChange={(e) => {
                    try { onUpdate({ config: { ...step.config, headers: JSON.parse(e.target.value) } }); } catch {}
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="input w-full text-xs font-mono min-h-[60px] resize-y"
                />
              </div>
            </div>
          )}

          {step.stepType === "SILENCE" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Silenciar por (segundos)</label>
              <input type="number" value={step.waitSeconds} onChange={(e) => onUpdate({ waitSeconds: parseInt(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} className="input w-full text-sm" />
            </div>
          )}

          {step.stepType === "INTENT" && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>Define las intenciones posibles</p>
              {<IntentRoutesEditor botId={id!} stepId={step.id} routes={step.intentRoutes} onRefresh={fetchBotData} />}
            </div>
          )}

          {step.stepType !== "SILENCE" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Tiempo de espera (segundos)</label>
              <input type="number" value={step.waitSeconds} onChange={(e) => onUpdate({ waitSeconds: parseInt(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} className="input w-full text-sm" min="0" />
            </div>
          )}

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Tipo de respuesta</label>
            <select value={step.responseType || "NONE"} onChange={(e) => onUpdate({ responseType: e.target.value })} onClick={(e) => e.stopPropagation()} className="input w-full text-sm">
              {RESPONSE_TYPES.map((rt) => (<option key={rt.value} value={rt.value}>{rt.label}</option>))}
            </select>
          </div>

          {step.responseType === "FREE_TEXT" && (
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Variable para capturar</label>
              <input value={step.responseCapture || ""} onChange={(e) => onUpdate({ responseCapture: e.target.value })} onClick={(e) => e.stopPropagation()} className="input w-full text-sm" placeholder="ej: nombre_usuario" />
            </div>
          )}

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Imagen, Video o Archivo</label>
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-sm cursor-pointer">
                <ImageIcon size={16} /> Subir archivo
                <input type="file" accept="image/*,video/*,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) alert("Upload de archivos se implementara en Fase 3"); }} />
              </label>
              {step.media && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{step.media.fileName}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntentRoutesEditor({ botId, stepId, routes, onRefresh }: { botId: string; stepId: string; routes: any[]; onRefresh: () => void }) {
  const [newLabel, setNewLabel] = useState("");
  const [newSamples, setNewSamples] = useState("");

  async function addRoute() {
    if (!newLabel.trim()) return;
    const samples = newSamples.split(",").map((s) => s.trim()).filter(Boolean);
    await api.post(`/api/bots/${botId}/steps/${stepId}/intents`, { label: newLabel.trim(), samples });
    setNewLabel("");
    setNewSamples("");
    onRefresh();
  }

  return (
    <div className="space-y-2">
      {routes.map((route: any) => (
        <div key={route.id} className="rounded-lg p-2" style={{ background: "var(--bg-elevated)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{route.label}</p>
          {route.samples.length > 0 && <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{route.samples.join(", ")}</p>}
        </div>
      ))}
      <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-hover)" }}>
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="input w-full text-xs" placeholder="Label (ej: quiere comprar)" />
        <input value={newSamples} onChange={(e) => setNewSamples(e.target.value)} className="input w-full text-xs" placeholder="Frases de ejemplo (separadas por coma)" />
        <button onClick={addRoute} className="btn-secondary text-xs py-1 px-3">Agregar intencion</button>
      </div>
    </div>
  );
}
