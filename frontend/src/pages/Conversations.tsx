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
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 bg-background">
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
                <button onClick={() => setShowContactPanel(!showContactPanel)} className="btn-icon !w-8 !h-8 hidden lg:flex" title="Panel de contacto">
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
                onTemplateSent={(newText) => {
                  setNewMessage(newText);
                  sendMessage();
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
        <div className="hidden lg:flex w-[320px] flex-col flex-shrink-0 border-l border-border bg-background">
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
          <Avatar id={contact.id} name={contact.name || contact.phone} size="lg" />
          <div>
            <p className="text-[14px] font-[650] text-ink tracking-tight">{contact.name || contact.phone}</p>
            <p className="text-[11.5px] text-ink-3">{contact.phone}</p>
          </div>
        </div>
        <button onClick={onClose} className="btn-icon !w-8 !h-8"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="section-label mb-2">Campos Personalizados</h3>
        {customValues.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">Sin campos personalizados</p>
        ) : (
          <div className="space-y-1.5">
            {customValues.map((cv: any) => (
              <div key={cv.id} className="flex justify-between py-1.5 border-b border-border text-[12.5px]">
                <span className="text-ink-2">{cv.customField.name}</span>
                <span className="text-ink font-medium">{cv.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ContactPanel({ conversation, contact, customValues, messages, statusSaving, actionError, onStatusChange, onConversationRefresh, onNoteAdded, onClose, onTagsChanged }: {
  conversation: Conversation | null;
  contact: ConversationContact | undefined;
  customValues: any[];
  messages: any[];
  statusSaving: boolean;
  actionError: string | null;
  onStatusChange: (status: string) => Promise<void>;
  onConversationRefresh: () => Promise<void>;
  onNoteAdded: (note: ContactNote) => void;
  onClose: () => void;
  onTagsChanged?: () => void | Promise<void>;
}) {
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTagDropdown) {
      api.get("/api/tags").then(({ data }) => setAvailableTags(data)).catch(() => {});
    }
  }, [showTagDropdown]);

  useEffect(() => {
    if (!showTagDropdown) return;
    function handleClick(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setShowTagDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTagDropdown]);

  async function toggleTag(tagId: string) {
    if (!contact) return;
    const hasTag = contact.tags?.some((ct) => ct.tag.id === tagId);
    try {
      if (hasTag) {
        await api.delete("/api/tags/assign", { data: { contactId: contact.id, tagId } });
      } else {
        await api.post("/api/tags/assign", { contactId: contact.id, tagId });
      }
      setShowTagDropdown(false);
      await onTagsChanged?.();
    } catch {}
  }
  if (!contact) return null;
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h3 className="section-label">Contacto</h3>
        <button onClick={onClose} className="btn-icon"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex flex-col items-center text-center pb-3 border-b border-border">
          <Avatar id={contact.id} name={contact.name || contact.phone} size="lg" />
          <p className="text-[14px] font-[650] text-ink mt-2 tracking-tight">{contact.name || "Sin nombre"}</p>
          <p className="text-[12px] text-ink-3 mt-0.5">{contact.phone}</p>
          {conversation?.leadScore !== undefined && (
            <div className="mt-2.5">
              <Badge variant={conversation.leadScore > 80 ? "success" : "default"}>
                <Hash size={10} className="mr-1" />Score: {conversation.leadScore}
              </Badge>
            </div>
          )}
        </div>

        {conversation && (
          <AiControl
            conversation={conversation}
            saving={statusSaving}
            error={actionError}
            onStatusChange={onStatusChange}
          />
        )}

        {conversation && (
          <PipelineSection contact={contact} onChanged={onConversationRefresh} />
        )}

        {conversation && <WindowSection conversation={conversation} />}

        {conversation && (
          <NotesSection contact={contact} onNoteAdded={onNoteAdded} />
        )}

        {conversation && (
          <div>
            <h4 className="section-label mb-2">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border p-2.5 text-center">
                <p className="text-[18px] font-[650] text-ink tracking-tight">{inbound}</p>
                <p className="text-[10.5px] text-ink-3 uppercase tracking-wide">Recibidos</p>
              </div>
              <div className="rounded-md border border-border p-2.5 text-center">
                <p className="text-[18px] font-[650] text-ink tracking-tight">{outbound}</p>
                <p className="text-[10.5px] text-ink-3 uppercase tracking-wide">Enviados</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2 relative">
            <h4 className="section-label">Etiquetas</h4>
            <button onClick={() => setShowTagDropdown(!showTagDropdown)} className="text-ink-3 hover:text-ink transition-colors" title="Agregar tag"><Plus size={12} /></button>
            {showTagDropdown && (
              <div ref={tagDropdownRef} className="absolute right-0 top-6 z-50 w-52 rounded-lg border border-border shadow-lg py-1" style={{ background: "var(--bg-card)" }}>
                {availableTags.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-ink-3">Sin etiquetas disponibles</p>
                ) : (
                  availableTags.map((tag) => {
                    const assigned = contact.tags?.some((ct) => ct.tag.id === tag.id);
                    return (
                      <button key={tag.id} onClick={() => toggleTag(tag.id)}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] hover:bg-atlas-hover transition-colors"
                        style={{ color: assigned ? tag.color : "var(--text-primary)" }}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                        <span className="flex-1 truncate">{tag.name}</span>
                        {assigned && <Check size={12} />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {contact.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {contact.tags.map((ct) => (
                <span key={ct.tag.id} className="text-[11px] px-2 py-0.5 rounded-sm font-medium" style={{ backgroundColor: ct.tag.color + "20", color: ct.tag.color }}>
                  {ct.tag.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-3">Sin etiquetas</p>
          )}
        </div>

        {customValues.length > 0 && (
          <div>
            <h4 className="section-label mb-2">Campos Personalizados</h4>
            <div className="space-y-1.5">
              {customValues.map((cv: any) => (
                <div key={cv.id} className="flex justify-between py-1.5 border-b border-border text-[12.5px]">
                  <span className="text-ink-2">{cv.customField.name}</span>
                  <span className="text-ink font-medium">{cv.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AiControl({ conversation, saving, error, onStatusChange }: {
  conversation: Conversation;
  saving: boolean;
  error: string | null;
  onStatusChange: (status: string) => Promise<void>;
}) {
  const aiActive = !!conversation.bot && conversation.status === "active" && !conversation.humanTakeover;
  const label = !conversation.bot
    ? "Sin IA asignada"
    : aiActive
      ? "IA activa"
      : conversation.humanTakeover
        ? "Atención humana"
        : "IA pausada";

  return (
    <section className="rounded-lg border border-border bg-atlas-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${aiActive ? "bg-brand-soft text-brand-text" : "bg-atlas-panel text-ink-3"}`}>
            <Bot size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[12.5px] font-[650] text-ink">{label}</h4>
            <p className="text-[11px] text-ink-3 truncate">{conversation.bot?.name || "Asigná un bot para automatizar"}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aiActive}
          aria-label={aiActive ? "Pausar IA" : "Reactivar IA"}
          disabled={!conversation.bot || saving}
          onClick={() => onStatusChange(aiActive ? "waiting_agent" : "active")}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${aiActive ? "bg-brand" : "bg-border"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiActive ? "translate-x-4 left-0.5" : "left-0.5"}`} />
        </button>
      </div>
      <p className="text-[11px] text-ink-3 mt-2.5 leading-relaxed">
        {aiActive
          ? "La IA responde automáticamente los mensajes entrantes."
          : conversation.humanTakeover
            ? "Una persona tiene el control; la IA no responderá."
            : "La automatización está detenida para esta conversación."}
      </p>
      {!aiActive && conversation.bot && (
        <Button size="sm" variant="outline" className="w-full mt-2.5" disabled={saving} onClick={() => onStatusChange("active")}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Reactivar IA
        </Button>
      )}
      {aiActive && (
        <p className="text-[10.5px] text-ink-3 mt-2 flex items-center gap-1"><Pause size={10} />Podés pausarla con el interruptor.</p>
      )}
      {!aiActive && conversation.bot && (
        <p className="text-[10.5px] text-ink-3 mt-2">La reactivación conserva la memoria y el paso actual.</p>
      )}
      {error && <p className="text-[11px] text-danger mt-2" role="alert">{error}</p>}
    </section>
  );
}

function PipelineSection({ contact, onChanged }: { contact: ConversationContact; onChanged: () => Promise<void> }) {
  const deal = contact.deals?.find((item) => item.status === "OPEN") || contact.deals?.[0];
  const [defaultPipeline, setDefaultPipeline] = useState<{ id: string; name: string; stages: PipelineStage[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDeals = !!contact.deals?.length;

  useEffect(() => {
    if (hasDeals) return;
    let cancelled = false;
    setLoading(true);
    api.get("/api/pipeline")
      .then(({ data }) => {
        if (cancelled) return;
        const pipeline = data.find((item: any) => item.isDefault && item.stages?.length) || data.find((item: any) => item.stages?.length);
        setDefaultPipeline(pipeline || null);
      })
      .catch((requestError) => { if (!cancelled) setError(apiError(requestError, "No se pudo cargar el pipeline.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contact.id, hasDeals]);

  async function moveDeal(stageId: string) {
    if (!deal || stageId === deal.stageId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/pipeline/deals/move", { dealId: deal.id, stageId });
      await onChanged();
    } catch (requestError: any) {
      setError(apiError(requestError, "No se pudo cambiar la etapa."));
    } finally {
      setSaving(false);
    }
  }

  async function createDeal() {
    const firstStage = defaultPipeline?.stages[0];
    if (!defaultPipeline || !firstStage) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/pipeline/deals", {
        name: `Oportunidad - ${contact.name || contact.phone}`,
        contactId: contact.id,
        pipelineId: defaultPipeline.id,
        stageId: firstStage.id,
        currency: "PYG",
      });
      await onChanged();
    } catch (requestError: any) {
      setError(apiError(requestError, "No se pudo crear la oportunidad."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h4 className="section-label mb-2">Etapa del pipeline</h4>
      <div className="rounded-md border border-border p-2.5">
        {deal ? (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: deal.stage.color }} />
              <p className="text-[12px] font-medium text-ink truncate">{deal.name}</p>
            </div>
            <select value={deal.stageId} disabled={saving} onChange={(event) => moveDeal(event.target.value)} className="w-full text-[12px] py-1.5 px-2 rounded-md border border-border bg-background text-ink disabled:opacity-50">
              {deal.pipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <p className="text-[10.5px] text-ink-3 mt-1.5">{deal.pipeline.name}</p>
          </>
        ) : loading ? (
          <p className="text-[12px] text-ink-3">Cargando pipeline...</p>
        ) : defaultPipeline ? (
          <>
            <p className="text-[11.5px] text-ink-3 mb-2">Este contacto aún no tiene una oportunidad.</p>
            <Button size="sm" variant="outline" className="w-full" disabled={saving} onClick={createDeal}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Crear oportunidad
            </Button>
          </>
        ) : (
          <p className="text-[11.5px] text-ink-3">No hay un pipeline con etapas configurado.</p>
        )}
        {error && <p className="text-[11px] text-danger mt-2" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function NotesSection({ contact, onNoteAdded }: { contact: ConversationContact; onNoteAdded: (note: ContactNote) => void }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent("");
    setError(null);
  }, [contact.id]);

  async function saveNote() {
    const noteContent = content.trim();
    if (!noteContent) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/conversations/${contact.id}/notes`, { content: noteContent });
      onNoteAdded(data.note);
      setContent("");
    } catch (requestError: any) {
      setError(apiError(requestError, "No se pudo guardar la nota."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h4 className="section-label mb-2">Notas internas</h4>
      <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={2} maxLength={2000} placeholder="Visible solo para el equipo..." className="text-[12px] min-h-[58px]" />
      <Button size="sm" variant="outline" className="w-full mt-2" disabled={saving || !content.trim()} onClick={saveNote}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Guardar nota
      </Button>
      {error && <p className="text-[11px] text-danger mt-2" role="alert">{error}</p>}
      <div className="space-y-2 mt-3">
        {contact.notes?.length ? contact.notes.map((note) => (
          <div key={note.id} className="rounded-md bg-atlas-subtle border border-border p-2.5">
            <p className="text-[12px] text-ink-2 whitespace-pre-wrap leading-relaxed">{note.content}</p>
            <p className="text-[10px] text-ink-3 mt-1.5">
              {note.agent?.name || "Equipo"} · {new Date(note.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
        )) : <p className="text-[11.5px] text-ink-3">Todavía no hay notas internas.</p>}
      </div>
    </section>
  );
}

function WindowSection({ conversation }: { conversation: Conversation }) {
  const window = getWindowState(conversation);
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="section-label">Ventana de atención</h4>
        <Badge variant={window.open ? "success" : "default"}>{window.open ? "Abierta" : "Cerrada"}</Badge>
      </div>
      <div className="rounded-md border border-border p-2.5 text-[12px]">
        {window.open && window.expiresAt ? (
          <>
            <div className="flex items-center gap-1.5 text-ink-2">
              {window.regularOpen ? <Clock size={12} className="text-success" /> : <Sparkles size={12} className="text-brand-text" />}
              <span>{window.regularOpen ? "Mensajes libres (24 h)" : "Ventana gratuita de anuncio (72 h)"}</span>
            </div>
            <p className="font-medium text-ink mt-1.5">{formatRemaining(window.expiresAt)}</p>
            <p className="text-[10.5px] text-ink-3 mt-0.5">Hasta {new Date(window.expiresAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</p>
          </>
        ) : (
          <div className="flex items-start gap-1.5 text-ink-3">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            <span>Cerrada. Meta solo permite iniciar con un template aprobado.</span>
          </div>
        )}
        {window.regularOpen && window.freeEntryPointOpen && window.freeEntryPointUntil && (
          <p className="text-[10.5px] text-brand-text border-t border-border mt-2 pt-2">
            Anuncio: ventana gratuita adicional hasta {new Date(window.freeEntryPointUntil).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}.
          </p>
        )}
      </div>
    </section>
  );
}

/* ── Window Closed Composer (24h enforcement) ────── */

function WindowClosedComposer({ onTemplateSent }: { onTemplateSent: (text: string) => void }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showTemplates && templates.length === 0) loadTemplates();
  }, [showTemplates]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/templates/approved");
      setTemplates(data.templates || []);
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="px-4 py-4 border-t border-border bg-warn-chip-bg">
      {!showTemplates ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <AlertTriangle size={14} className="text-warn-chip-text" />
            <p className="text-[12.5px] font-[600] text-warn-chip-text">Ventana 24h cerrada</p>
          </div>
          <p className="text-[11.5px] text-warn-chip-text/80 mb-3 leading-relaxed">
            Meta no permite mensajes libres fuera de la ventana. Usa un template aprobado para reabrirla.
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <Send size={12} />Reabrir con template
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label text-warn-chip-text">Templates aprobados</p>
            <button onClick={() => setShowTemplates(false)} className="text-warn-chip-text hover:opacity-70">
              <X size={12} />
            </button>
          </div>
          {loading ? (
            <Loader2 className="animate-spin mx-auto block" size={16} style={{ color: "var(--warn-chip-text)" }} />
          ) : templates.length === 0 ? (
            <p className="text-[11.5px] text-warn-chip-text/80 text-center py-2">No hay templates aprobados</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {templates.slice(0, 5).map((t) => (
                <button key={t.id} onClick={() => onTemplateSent(`[TEMPLATE: ${t.name}] ${t.bodyText}`)}
                  className="w-full text-left p-2 rounded-md border border-warn-chip-border bg-background hover:bg-warn-chip-bg transition-colors">
                  <p className="text-[11.5px] font-[600] text-ink">{t.name}</p>
                  <p className="text-[11px] text-ink-2 line-clamp-2">{t.bodyText}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Composer with media upload + drag-drop ─────────── */

function Composer({ newMessage, setNewMessage, sendMessage, conversationId }: {
  newMessage: string;
  setNewMessage: (v: string) => void;
  sendMessage: (override?: string) => Promise<void>;
  conversationId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption] = useState("");

  function detectType(file: File): string {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  }

  function handleFileSelect(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      alert("Maximo 50MB");
      return;
    }
    const type = detectType(file);
    const preview = type === "image" || type === "video" ? URL.createObjectURL(file) : "";
    setPendingFile({ file, preview, type });
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  async function sendFile() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", pendingFile.file);
      if (caption) form.append("caption", caption);
      form.append("type", pendingFile.type);
      await api.post(`/api/conversations/${conversationId}/media`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPendingFile(null);
      setCaption("");
      // Trigger a refetch of messages
      window.dispatchEvent(new Event("focus"));
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  }

  function clearPending() {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
    setCaption("");
  }

  return (
    <div
      className={`px-3 py-3 border-t flex-shrink-0 bg-background ${dragOver ? "border-brand bg-brand-tint" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* File preview */}
      {pendingFile && (
        <div className="mb-2 p-2 rounded-md border border-border bg-atlas-subtle flex items-start gap-2">
          {pendingFile.type === "image" && (
            <img src={pendingFile.preview} className="w-14 h-14 object-cover rounded" />
          )}
          {pendingFile.type === "video" && (
            <video src={pendingFile.preview} className="w-14 h-14 object-cover rounded" muted />
          )}
          {pendingFile.type === "audio" && (
            <div className="w-14 h-14 rounded bg-atlas-panel flex items-center justify-center">
              <Mic size={20} className="text-ink-2" />
            </div>
          )}
          {pendingFile.type === "document" && (
            <div className="w-14 h-14 rounded bg-atlas-panel flex items-center justify-center">
              <FileText size={20} className="text-ink-2" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-[600] text-ink truncate">{pendingFile.file.name}</p>
            <p className="text-[10.5px] text-ink-3">
              {(pendingFile.file.size / 1024).toFixed(1)} KB · {pendingFile.type}
            </p>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (opcional)"
              className="input text-[12px] mt-1.5 h-8"
            />
          </div>
          <button onClick={clearPending} className="btn-icon" title="Quitar">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={onFileInput}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-icon !w-10 !h-10 flex-shrink-0"
          title="Adjuntar archivo"
        >
          <Paperclip size={18} />
        </button>
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
          className="min-h-[40px] max-h-32"
          placeholder={pendingFile ? "Caption..." : "Escribe un mensaje o arrastra un archivo..."}
        />
        {pendingFile ? (
          <Button onClick={sendFile} disabled={uploading} size="icon" className="h-10 w-10">
            {uploading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </Button>
        ) : (
          <Button onClick={() => sendMessage()} disabled={!newMessage.trim()} size="icon" className="h-10 w-10">
            <Send size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Media Content Renderer ─────────────────────── */

function MediaContent({ msg }: { msg: any }) {
  const url = msg.mediaUrl;
  const type = msg.type;

  if (type === "image" || type === "sticker") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={url} alt={msg.mediaFilename || "imagen"} className="rounded-md max-w-full max-h-80 object-cover" loading="lazy" />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video src={url} controls className="rounded-md max-w-full max-h-80" preload="metadata">
        Tu navegador no soporta video.
      </video>
    );
  }

  if (type === "audio" || type === "voice") {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-9 h-9 rounded-full bg-atlas-panel flex items-center justify-center flex-shrink-0">
          <Mic size={16} style={{ color: "var(--ink-2)" }} />
        </div>
        <audio src={url} controls className="h-9 flex-1" preload="metadata" />
      </div>
    );
  }

  if (type === "document") {
    const sizeKb = msg.mediaSize ? (msg.mediaSize / 1024).toFixed(1) : "?";
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2.5 p-2.5 rounded-md border bg-atlas-subtle border-border hover:border-brand transition-colors min-w-[200px]">
        <div className="w-9 h-9 rounded-md bg-background flex items-center justify-center flex-shrink-0">
          <FileText size={18} style={{ color: "var(--ink-2)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium text-ink truncate">{msg.mediaFilename || "documento"}</p>
          <p className="text-[10.5px] text-ink-3">{sizeKb} KB</p>
        </div>
        <Download size={14} className="text-ink-3" />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] underline">
      Descargar archivo
    </a>
  );
}
