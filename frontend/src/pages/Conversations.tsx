import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { io } from "socket.io-client";
import {
  Search, Send, Users, Download, MessageSquare, User, Phone,
} from "lucide-react";

interface Conversation {
  id: string;
  status: string;
  contact: { id: string; phone: string; name: string | null };
  bot: { name: string } | null;
  assignedAgent: { name: string } | null;
  messages: { id: string; content: string; direction: string; timestamp: string }[];
  updatedAt: string;
}

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  _count: { conversations: number };
}

const statusColors: Record<string, string> = {
  active: "var(--success)",
  waiting_agent: "var(--warning)",
  silenced: "var(--info)",
  closed: "var(--text-tertiary)",
};

const statusLabels: Record<string, string> = {
  active: "Activa",
  waiting_agent: "Esperando agente",
  silenced: "Silenciada",
  closed: "Cerrada",
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
    setupSocket();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function setupSocket() {
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:4000");
    socketRef.current = socket;
    socket.on("message:new", (msg: any) => {
      if (selectedConv?.id === msg.conversationId) setMessages((prev) => [...prev, msg]);
      fetchData();
    });
    socket.on("conversation:updated", () => fetchData());
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
      setConversations(convRes.data.conversations);
      setContacts(contactRes.data.contacts);
    } finally { setLoading(false); }
  }

  async function selectConversation(conv: Conversation) {
    setSelectedConv(conv);
    setSelectedContact(null);
    try {
      const { data } = await api.get(`/api/conversations/${conv.id}`);
      setMessages(data.conversation.messages || []);
      socketRef.current?.emit("join-conversation", conv.id);
    } catch {}
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConv) return;
    try {
      const { data } = await api.post(`/api/conversations/${selectedConv.id}/messages`, { content: newMessage.trim() });
      setMessages([...messages, data.message]);
      setNewMessage("");
    } catch {}
  }

  async function updateStatus(status: string) {
    if (!selectedConv) return;
    await api.put(`/api/conversations/${selectedConv.id}/status`, { status });
    setSelectedConv({ ...selectedConv, status });
    fetchData();
  }

  async function fetchContactCustomFields(contactId: string) {
    try {
      const { data } = await api.get(`/api/customfields/contact/${contactId}`);
      setContactCustomValues(data);
    } catch { setContactCustomValues([]); }
  }

  async function exportContacts() {
    const res = await api.get("/api/conversations/contacts/export", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contactos.csv";
    a.click();
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6" style={{ background: "var(--bg-base)" }}>
      {/* Left panel */}
      <div className="w-80 flex flex-col flex-shrink-0" style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}>
        <div className="p-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Conversaciones</h2>
            <div className="flex gap-1">
              <button onClick={() => setShowContacts(!showContacts)} className="btn-icon !w-8 !h-8" title="Contactos">
                <Users size={15} />
              </button>
              <button onClick={exportContacts} className="btn-icon !w-8 !h-8" title="Exportar CSV">
                <Download size={15} />
              </button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--text-tertiary)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input w-full pl-9 text-sm" placeholder="Buscar..." />
          </div>
          <div className="flex gap-2">
            {["", "active", "waiting_agent", "silenced"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs px-2 py-1 rounded transition-colors ${statusFilter === s ? "bg-[var(--accent)] text-white" : "text-[var(--text-tertiary)]"}`}
                style={{ background: statusFilter === s ? "var(--accent)" : "var(--bg-muted)" }}
              >
                {s ? statusLabels[s] : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showContacts ? (
            contacts.map((contact) => (
              <div key={contact.id} onClick={() => { setSelectedContact(contact); setSelectedConv(null); fetchContactCustomFields(contact.id); }}
                className="p-3 border-b cursor-pointer transition-colors"
                style={{ borderColor: "var(--border-default)", background: selectedContact?.id === contact.id ? "var(--bg-hover)" : "transparent" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{contact.name || contact.phone}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{contact.phone}</p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{contact._count.conversations}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {contact.tags.map((ct) => (
                    <span key={ct.tag.id} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: ct.tag.color + "33", color: ct.tag.color }}>
                      {ct.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : loading ? (
            <div className="p-4 text-center" style={{ color: "var(--text-tertiary)" }}>Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center" style={{ color: "var(--text-tertiary)" }}>Sin conversaciones</div>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} onClick={() => selectConversation(conv)}
                className="p-3 border-b cursor-pointer transition-colors"
                style={{
                  borderColor: "var(--border-default)",
                  background: selectedConv?.id === conv.id ? "var(--bg-hover)" : "transparent",
                  borderLeft: selectedConv?.id === conv.id ? "3px solid var(--accent)" : "3px solid transparent",
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                    <Phone size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{conv.contact.name || conv.contact.phone}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{conv.messages[0]?.content || "Sin mensajes"}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColors[conv.status] || "var(--text-tertiary)" }} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {conv.bot && <span className="pill text-xs !py-0.5">{conv.bot.name}</span>}
                  {conv.assignedAgent && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{conv.assignedAgent.name}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact && selectedContact.id !== selectedConv?.contact.id ? (
          <>
            <div className="p-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                  <User size={20} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>{selectedContact.name || selectedContact.phone}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{selectedContact.phone}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Campos Personalizados</h3>
              {contactCustomValues.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Sin campos personalizados</p>
              ) : (
                <div className="space-y-2">
                  {contactCustomValues.map((cv: any) => (
                    <div key={cv.id} className="flex justify-between py-1.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{cv.customField.name}</span>
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{cv.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : selectedConv ? (
          <>
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-muted)", color: "var(--text-tertiary)" }}>
                  <Phone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{selectedConv.contact.name || selectedConv.contact.phone}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{selectedConv.contact.phone}</p>
                </div>
              </div>
              <select value={selectedConv.status} onChange={(e) => updateStatus(e.target.value)} className="input text-xs py-1 w-auto">
                <option value="active">Activa</option>
                <option value="waiting_agent">Esperando agente</option>
                <option value="silenced">Silenciada</option>
                <option value="closed">Cerrada</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: "#0b141a" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={msg.direction === "outbound" ? "bubble-out" : "bubble-in"}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs mt-1 text-right" style={{ color: msg.direction === "outbound" ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)" }}>
                      {new Date(msg.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} className="input flex-1" placeholder="Escribe un mensaje..." />
              <button onClick={sendMessage} className="btn-primary"><Send size={18} /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.3 }} />
              <p style={{ color: "var(--text-tertiary)" }}>Selecciona una conversacion</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
