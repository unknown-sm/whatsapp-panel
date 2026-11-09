import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { io } from "socket.io-client";
import {
  Search, Send, Users, Download, MessageSquare, Sparkles, Trash2,
  Check, CheckCheck, X, Clock, ChevronRight,
  AlertCircle, AlertTriangle, UserCheck, ArrowRight, ArrowLeft, Hash, Plus, Loader2,
  FileText, Mic, Bot, Pause, Play,
  Paperclip, RotateCcw,
} from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";

interface ConversationWindow {
  windowExpiresAt: string;
  isOpen: boolean;
  freeEntryPointUntil: string | null;
  fepReplyDeadline?: string | null;
}

interface ContactNote {
  id: string;
  content: string;
  createdAt: string;
  agent: { name: string | null } | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface ConversationDeal {
  id: string;
  name: string;
  status: "OPEN" | "WON" | "LOST";
  stageId: string;
  stage: PipelineStage;
  pipeline: { id: string; name: string; stages: PipelineStage[] };
}

interface ConversationContact {
  id: string;
  phone: string;
  name: string | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
  notes?: ContactNote[];
  conversationWindow?: ConversationWindow | null;
  deals?: ConversationDeal[];
}

interface Conversation {
  id: string;
  status: string;
  humanTakeover?: boolean;
  contact: ConversationContact;
  bot: { name: string } | null;
  assignedAgent: { name: string } | null;
  messages: { id: string; content: string; direction: string; timestamp: string; aiGenerated?: boolean; type?: string; mediaUrl?: string; mediaMimeType?: string; mediaFilename?: string; mediaSize?: number; transcription?: string }[];
  updatedAt: string;
  windowExpiresAt?: string | null;
  windowOpen?: boolean;
  freeEntryPointUntil?: string | null;
  leadScore?: number;
}

interface Contact extends ConversationContact {
  tags: { tag: { id: string; name: string; color: string } }[];
  _count: { conversations: number };
}

interface Suggestion {
  id: string;
  text: string;
  tone: string;
  reasoning: string;
}

const statusColors: Record<string, string> = {
  active: "var(--success)",
  waiting_agent: "var(--warning)",
  silenced: "var(--info)",
  closed: "var(--text-3)",
};

const statusLabels: Record<string, string> = {
  active: "Activa",
  waiting_agent: "Esperando agente",
  silenced: "Silenciada",
  closed: "Cerrada",
};

const STORAGE_KEY = "atlas.inbox.panel";

function getWindowState(conversation: Conversation) {
  const window = conversation.contact.conversationWindow;
  const regularExpiresAt = window?.windowExpiresAt || conversation.windowExpiresAt || null;
  const freeEntryPointUntil = window?.freeEntryPointUntil || conversation.freeEntryPointUntil || null;
  const now = Date.now();
  const regularOpen = window
    ? window.isOpen && new Date(regularExpiresAt || 0).getTime() > now
    : conversation.windowOpen === true && new Date(regularExpiresAt || 0).getTime() > now;
  const freeEntryPointOpen = !!freeEntryPointUntil && new Date(freeEntryPointUntil).getTime() > now;
  return {
    open: regularOpen || freeEntryPointOpen,
    regularOpen,
    freeEntryPointOpen,
    expiresAt: regularOpen ? regularExpiresAt : freeEntryPointOpen ? freeEntryPointUntil : regularExpiresAt,
    regularExpiresAt,
    freeEntryPointUntil,
  };
}

function formatRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Vencida";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h restantes`;
  if (hours > 0) return `${hours} h ${minutes} min restantes`;
  return `${minutes} min restantes`;
}

function apiError(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactCustomValues, setContactCustomValues] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setClock] = useState(Date.now());
  const [showContactPanel, setShowContactPanel] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "false"; } catch { return true; }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  // Ref espejo de selectedConv: el handler del socket se registra una sola vez
  // (closure) y sin esto siempre vería selectedConv = null.
  const selectedConvRef = useRef<Conversation | null>(null);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  useEffect(() => {
    fetchData();
    setupSocket();
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => { socketRef.current?.disconnect(); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Las sugerencias ya no se generan solas (cada llamada gasta tokens):
    // se limpian al cambiar de conversacion y solo se generan con el boton.
    setSuggestions([]);
    setActionError(null);
  }, [selectedConv?.id]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(showContactPanel)); } catch {}
  }, [showContactPanel]);

  function setupSocket() {
    const socket = io(import.meta.env.VITE_API_URL || "", {
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;
    socket.on("message:new", (msg: any) => {
      if (selectedConvRef.current?.id === msg.conversationId) setMessages((prev) => [...prev, msg]);
      fetchData();
    });
    socket.on("conversation:updated", (payload: { id?: string }) => {
      fetchData();
      if (payload?.id && selectedConvRef.current?.id === payload.id) {
        refreshConversation(payload.id).catch(() => {});
      }
    });
  }

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const [convRes, contactRes] = await Promise.all([
        api.get(`/api/conversations?${params}`),
        api.get(`/api/conversations/contacts?${search ? `search=${search}` : ""}`),
      ]);
      setConversations(convRes.data.conversations || []);
      setContacts(contactRes.data.contacts || []);
    } finally { setLoading(false); }
  }

  async function refreshConversation(conversationId: string) {
    const { data } = await api.get(`/api/conversations/${conversationId}`);
    if (selectedConvRef.current?.id !== conversationId) return null;
    setSelectedConv(data.conversation);
    setMessages(data.conversation.messages || []);
    return data.conversation as Conversation;
  }

  async function selectConversation(conv: Conversation) {
    selectedConvRef.current = conv;
    setSelectedConv(conv);
    setSelectedContact(null);
    try {
      await refreshConversation(conv.id);
      await fetchContactCustomFields(conv.contact.id);
      socketRef.current?.emit("join-conversation", conv.id);
    } catch (error: any) {
      setActionError(apiError(error, "No se pudo cargar la conversación."));
    }
  }

  async function sendMessage(textOverride?: string) {
    const content = (textOverride ?? newMessage).trim();
    if (!content || !selectedConv) return;
    try {
      const { data } = await api.post(`/api/conversations/${selectedConv.id}/messages`, { content });
      setMessages([...messages, data.message]);
      setNewMessage("");
      setSuggestions([]);
    } catch {}
  }

  async function updateStatus(status: string) {
    const reactivatingTakeover = status === "active" && selectedConv?.humanTakeover;
    if (!selectedConv || statusSaving || (selectedConv.status === status && !reactivatingTakeover)) return;
    const conversationId = selectedConv.id;
    setStatusSaving(true);
    setActionError(null);
    try {
      const { data } = await api.put(`/api/conversations/${conversationId}/status`, { status });
      const updated = data.conversation as Partial<Conversation>;
      setSelectedConv((current) => current?.id === conversationId ? { ...current, ...updated } : current);
      setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, ...updated } : item));
      await fetchData();
    } catch (error: any) {
      setActionError(apiError(error, "No se pudo actualizar el estado de la conversación."));
    } finally {
      setStatusSaving(false);
    }
  }

  async function resetBot() {
    if (!selectedConv) return;
    setActionError(null);
    try {
      await api.post(`/api/conversations/${selectedConv.id}/reset-bot`);
      await Promise.all([fetchData(), refreshConversation(selectedConv.id)]);
    } catch (error: any) {
      setActionError(apiError(error, "No se pudo reiniciar la memoria del bot."));
    }
  }

  async function fetchContactCustomFields(contactId: string) {
    try {
      const { data } = await api.get(`/api/customfields/contact/${contactId}`);
      setContactCustomValues(data);
    } catch { setContactCustomValues([]); }
  }

  async function handleContextChanged() {
    await fetchData();
    if (selectedConvRef.current) await refreshConversation(selectedConvRef.current.id);
  }

  function handleNoteAdded(note: ContactNote) {
    setSelectedConv((current) => current ? {
      ...current,
      contact: { ...current.contact, notes: [note, ...(current.contact.notes || [])] },
    } : current);
  }

  async function fetchSuggestions() {
    if (!selectedConv) return;
    setLoadingSuggestions(true);
    try {
      const { data } = await api.post("/api/ai/suggest-responses", {
        conversationId: selectedConv.id,
      });
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function exportContacts() {
    const res = await api.get("/api/conversations/contacts/export", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contactos.csv";
    a.click();
  }

  async function deleteContact(contactId: string) {
    if (!confirm("Eliminar contacto y todas sus conversaciones?")) return;
    await api.delete(`/api/conversations/contacts/${contactId}`);
    fetchData();
  }

  function getWindowBadge(conv: Conversation) {
    const window = getWindowState(conv);
    if (!window.open || !window.expiresAt) return null;
    const ms = new Date(window.expiresAt).getTime() - Date.now();
    const hours = Math.floor(ms / 3600000);
    if (hours < 2) return <Badge variant="warning"><Clock size={10} className="mr-1" />{hours}h</Badge>;
    return <span className="w-1.5 h-1.5 rounded-full bg-success" />;
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 bg-background">
      {/* ── Left column: conversation list (360px) ──────────── */}
      <div className={`${selectedConv || selectedContact ? "hidden md:flex" : "flex"} w-full md:w-[360px] flex-col flex-shrink-0 border-r border-border bg-background`}>
        <div className="p-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[15px] font-[650] tracking-tight text-ink">Conversaciones</h2>
            <div className="flex gap-1">
              <button onClick={() => setShowContacts(!showContacts)} className="btn-icon" title="Contactos">
                <Users size={14} />
              </button>
              <button onClick={exportContacts} className="btn-icon" title="Exportar CSV">
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--text-3)" }} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-[13px]" placeholder="Buscar..." />
          </div>
          <div className="flex gap-1.5">
            {["", "active", "waiting_agent", "silenced"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2 py-0.5 rounded-sm transition-colors ${statusFilter === s ? "bg-brand-soft text-brand-text font-medium" : "text-ink-2 hover:bg-atlas-hover"}`}>
                {s ? statusLabels[s] : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showContacts ? (
            contacts.map((contact) => (
              <div key={contact.id} onClick={() => { setSelectedContact(contact); setSelectedConv(null); fetchContactCustomFields(contact.id); }}
                className={`relative p-3 border-b border-border cursor-pointer transition-colors hover:bg-atlas-hover ${selectedContact?.id === contact.id ? "bg-brand-tint" : ""}`}>
                {selectedContact?.id === contact.id && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand" />}
                <div className="flex items-center gap-2.5">
                  <Avatar id={contact.id} name={contact.name || contact.phone} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate text-ink">{contact.name || contact.phone}</p>
                    <p className="text-[11px] truncate text-ink-3">{contact.phone}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteContact(contact.id); }} className="p-1 rounded hover:bg-red-50" title="Eliminar contacto">
                    <Trash2 size={14} className="text-ink-3 hover:text-danger" />
                  </button>
                  <span className="text-[11px] text-ink-3">{contact._count.conversations}</span>
                </div>
                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {contact.tags.slice(0, 3).map((ct) => (
                      <span key={ct.tag.id} className="text-[10.5px] px-1.5 py-0.5 rounded-sm font-medium" style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                        {ct.tag.name}
                      </span>
                    ))}
                    {contact.tags.length > 3 && <span className="text-[10.5px] text-ink-3">+{contact.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            ))
          ) : loading ? (
            <div className="p-8 text-center text-ink-3 text-[13px]">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-ink-3 text-[13px]">Sin conversaciones</div>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} onClick={() => selectConversation(conv)}
                className={`relative p-3 border-b border-border cursor-pointer transition-colors hover:bg-atlas-hover ${selectedConv?.id === conv.id ? "bg-brand-tint" : ""}`}>
                {selectedConv?.id === conv.id && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand" />}
                <div className="flex items-center gap-2.5">
                  <Avatar id={conv.contact.id} name={conv.contact.name || conv.contact.phone} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium truncate text-ink">{conv.contact.name || conv.contact.phone}</p>
                      {getWindowBadge(conv)}
                    </div>
                    <p className="text-[11.5px] truncate text-ink-2 mt-0.5">
                      {conv.messages[0]?.content || "Sin mensajes"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 ml-10">
                  {conv.bot && <span className="pill text-[10.5px] !py-0 !px-2">{conv.bot.name}</span>}
                  {conv.assignedAgent && <span className="text-[10.5px] text-ink-3">{conv.assignedAgent.name}</span>}
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: statusColors[conv.status] || "var(--text-3)" }} title={statusLabels[conv.status]} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Center column: thread ────────────────────────────── */}
      <div className={`${selectedConv || selectedContact ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {selectedContact && selectedContact.id !== selectedConv?.contact.id ? (
          <ContactEmptyState
            contact={selectedContact}
            customValues={contactCustomValues}
            onClose={() => setSelectedContact(null)}
          />
        ) : selectedConv ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0 bg-background">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => { selectedConvRef.current = null; setSelectedConv(null); setSelectedContact(null); }} className="md:hidden btn-icon !w-8 !h-8 flex-shrink-0" title="Volver">
                  <ArrowLeft size={16} />
                </button>
                <Avatar id={selectedConv.contact.id} name={selectedConv.contact.name || selectedConv.contact.phone} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-[650] text-ink tracking-tight">{selectedConv.contact.name || selectedConv.contact.phone}</p>
                    {getWindowState(selectedConv).open && (
                      <span className="w-1.5 h-1.5 rounded-full bg-success" title="Ventana de atención abierta" />
                    )}
                    {selectedConv.assignedAgent && (
                      <Badge variant="default"><UserCheck size={10} className="mr-1" />{selectedConv.assignedAgent.name}</Badge>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-3">{selectedConv.contact.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedConv.status} disabled={statusSaving} onChange={(e) => updateStatus(e.target.value)} className="text-[12px] py-1 px-2 rounded-md border border-border bg-background text-ink disabled:opacity-50">
                  <option value="active">Activa</option>
                  <option value="waiting_agent">Esperando agente</option>
                  <option value="silenced">Silenciada</option>
                  <option value="closed">Cerrada</option>
                </select>
                <button onClick={resetBot} className="btn-icon !w-8 !h-8" title="Reiniciar memoria del bot (para pruebas)">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => setShowContactPanel(!showContactPanel)} className="btn-icon !w-8 !h-8 flex" title="Panel de contacto" aria-label="Panel de contacto">
                  <ChevronRight size={14} className={`transition-transform ${showContactPanel ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {actionError && (
              <div className="px-4 py-2 border-b border-border text-danger text-[12px] flex items-center gap-2" style={{ background: "var(--danger-muted)" }} role="alert">
                <AlertCircle size={13} className="flex-shrink-0" />{actionError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5" style={{ background: "var(--chat-bg)" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={msg.direction === "outbound" ? "bubble-out" : "bubble-in"} style={{ maxWidth: msg.type !== "text" ? "75%" : undefined }}>
                    {msg.aiGenerated && (
                      <div className="flex items-center gap-1 mb-1 text-[10.5px] opacity-60">
                        <Sparkles size={10} /> IA
                      </div>
                    )}
                    {msg.type && msg.type !== "text" && msg.mediaUrl && (
                      <MediaContent msg={msg} />
                    )}
                    {msg.content && msg.content !== `[${msg.type}]` && (
                      <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.transcription && (
                      <div className="mt-1.5 p-2 rounded text-[12px] italic border-t" style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}>
                        <span className="text-[10.5px] uppercase tracking-wide text-ink-3 not-italic">Transcripción</span>
                        <br />
                        {msg.transcription}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-0.5 text-[10.5px]" style={{ color: "var(--text-3)" }}>
                      <span>{new Date(msg.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                      {msg.direction === "outbound" && (msg.aiGenerated ? <Sparkles size={10} /> : <CheckCheck size={12} />)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ── AI Suggestions panel (on demand) ──────────── */}
            <div className="px-4 py-3 border-t border-border bg-atlas-subtle">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-brand-text" />
                  <span className="section-label">Respuestas sugeridas</span>
                </div>
                <button
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-background hover:border-brand hover:text-brand-text transition-colors disabled:opacity-50"
                >
                  {loadingSuggestions ? "Generando..." : suggestions.length > 0 ? "Regenerar" : "Sugerir respuestas"}
                </button>
              </div>
              {loadingSuggestions ? (
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 flex-1" />)}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {suggestions.map((s) => (
                    <button key={s.id} onClick={() => sendMessage(s.text)}
                      className="text-left p-2.5 rounded-md border border-border bg-background hover:border-brand hover:bg-brand-tint transition-all group">
                      <p className="text-[12px] text-ink leading-relaxed line-clamp-3">{s.text}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-ink-3 uppercase tracking-wide">{s.tone}</span>
                        <ArrowRight size={11} className="text-ink-3 group-hover:text-brand-text transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-ink-3">Tocá "Sugerir respuestas" para generar 3 opciones con IA (usa tokens).</p>
              )}
            </div>

            {/* ── Composer (24h + Free Entry Point enforcement) ──────────── */}
            {!getWindowState(selectedConv).open ? (
              <WindowClosedComposer
                conversationId={selectedConv.id}
                onSent={(message) => {
                  if (selectedConvRef.current?.id === selectedConv.id) {
                    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
                    setSelectedConv((current) => current?.id === selectedConv.id ? { ...current, humanTakeover: true, updatedAt: message.timestamp } : current);
                  }
                  fetchData();
                  refreshConversation(selectedConv.id).catch(() => {});
                }}
              />
            ) : (
              <Composer
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                sendMessage={sendMessage}
                conversationId={selectedConv.id}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-atlas-panel mx-auto mb-4 flex items-center justify-center">
                <MessageSquare size={28} className="text-ink-3 opacity-60" />
              </div>
              <p className="text-[14px] font-[650] text-ink tracking-tight mb-1">Inbox de conversaciones</p>
              <p className="text-[12px] text-ink-3">Selecciona una conversación para ver mensajes y respuestas sugeridas por IA.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right column: contact panel (320px, collapsible) ── */}
      {showContactPanel && (selectedConv || selectedContact) && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[320px] flex-col border-l border-border bg-background shadow-xl lg:static lg:z-auto lg:w-[320px] lg:flex-shrink-0 lg:shadow-none">
          <ContactPanel
            conversation={selectedConv}
            contact={selectedContact || selectedConv?.contact}
            customValues={selectedConv ? contactCustomValues : []}
            messages={messages}
            statusSaving={statusSaving}
            actionError={actionError}
            onStatusChange={updateStatus}
            onConversationRefresh={handleContextChanged}
            onNoteAdded={handleNoteAdded}
            onClose={() => setShowContactPanel(false)}
            onTagsChanged={handleContextChanged}
          />
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function ContactEmptyState({ contact, customValues, onClose }: { contact: Contact; customValues: any[]; onClose: () => void }) {
  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="btn-icon !w-8 !h-8"><X size={14} /></button>
        </div>
      </div>
    </>
  );
}
