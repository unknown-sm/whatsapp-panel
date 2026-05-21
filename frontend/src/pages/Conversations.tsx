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
      if (selectedConv?.id === msg.conversationId) {
        setMessages((prev) => [...prev, msg]);
      }
      fetchData();
    });

    socket.on("conversation:updated", () => {
      fetchData();
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
      setConversations(convRes.data.conversations);
      setContacts(contactRes.data.contacts);
    } finally {
      setLoading(false);
    }
  }

  async function selectConversation(conv: Conversation) {
    setSelectedConv(conv);
    try {
      const { data } = await api.get(`/api/conversations/${conv.id}`);
      setMessages(data.conversation.messages || []);
      socketRef.current?.emit("join-conversation", conv.id);
    } catch {}
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConv) return;
    try {
      const { data } = await api.post(`/api/conversations/${selectedConv.id}/messages`, {
        content: newMessage.trim(),
      });
      setMessages([...messages, data.message]);
      setNewMessage("");
      socketRef.current?.emit("message:send", {
        conversationId: selectedConv.id,
        content: newMessage.trim(),
      });
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
    } catch {
      setContactCustomValues([]);
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

  const statusColors: Record<string, string> = {
    active: "bg-accent-500",
    waiting_agent: "bg-yellow-500",
    silenced: "bg-blue-500",
    closed: "bg-dark-500",
  };

  const statusLabels: Record<string, string> = {
    active: "Activa",
    waiting_agent: "Esperando agente",
    silenced: "Silenciada",
    closed: "Cerrada",
  };

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      {/* Left panel - Conversation list */}
      <div className="w-80 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Conversaciones</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowContacts(!showContacts)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)]" title="Contactos">
                <Users size={18} />
              </button>
              <button onClick={exportContacts} className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)]" title="Exportar CSV">
                <Download size={18} />
              </button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9 text-sm"
              placeholder="Buscar..."
            />
          </div>
          <div className="flex gap-2">
            {["", "active", "waiting_agent", "silenced"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2 py-1 rounded ${statusFilter === s ? "bg-accent-600 text-[var(--text-primary)]" : "bg-[var(--bg-elevated)] text-[var(--text-tertiary)]"}`}
              >
                {s ? statusLabels[s] : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showContacts ? (
            contacts.map((contact) => (
              <div key={contact.id} onClick={() => { setSelectedContact(contact); fetchContactCustomFields(contact.id); }} className={`p-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] cursor-pointer ${selectedContact?.id === contact.id ? "bg-[var(--bg-elevated)]" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--bg-hover)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{contact.name || contact.phone}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{contact.phone}</p>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">{contact._count.conversations}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {contact.tags.map((ct) => (
                    <span key={ct.tag.id} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: ct.tag.color + "33", color: ct.tag.color }}>
                      {ct.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : loading ? (
            <div className="p-4 text-[var(--text-tertiary)] text-center">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-[var(--text-tertiary)] text-center">Sin conversaciones</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-3 border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--bg-elevated)] ${selectedConv?.id === conv.id ? "bg-[var(--bg-elevated)] border-l-2 border-l-accent-600" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--bg-hover)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
                    <Phone size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{conv.contact.name || conv.contact.phone}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {conv.messages[0]?.content || "Sin mensajes"}
                    </p>
                  </div>
                  <span className={`status-dot ${statusColors[conv.status] || "bg-dark-500"}`} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-tertiary)]">
                  {conv.bot && <span className="pill text-xs">{conv.bot.name}</span>}
                  {conv.assignedAgent && <span>{conv.assignedAgent.name}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel - Chat \/ Contact Detail */}
      <div className="flex-1 flex- flex-col">
        {selectedContact && selectedContact.id !== selectedConv?.contact.id ? (
          // Contact detail view
          <>
            <div className="p-4 border-bottom border-[var(--border-default)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>{selectedContact.name || selectedContact.phone}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{selectedContact.phone}</p>
                </div>
              </div>
            </div>
            <div className="p-4 " style={{ color: "var(--text-primary)" }}>
              <h3 className="text-sm font-semibold mb-2">Campos Personalizados</h3>
              {contactCustomValues.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Sin campos personalizados</p>
              ) : (
                <div className="space-y-2">
                  {contactCustomValues.map((cv: any) => (
                    <div key={cv.id} className="flex justify-between">
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
            {/* Chat header */}
            <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--bg-hover)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-medium">{selectedConv.contact.name || selectedConv.contact.phone}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{selectedConv.contact.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedConv.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="input text-xs py-1"
                >
                  <option value="active">Activa</option>
                  <option value="waiting_agent">Esperando agente</option>
                  <option value="silenced">Silenciada</option>
                  <option value="closed">Cerrada</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0b141a] space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={msg.direction === "outbound" ? "bubble-out" : "bubble-in"}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-[var(--border-default)] flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="input flex-1"
                placeholder="Escribe un mensaje..."
              />
              <button onClick={sendMessage} className="btn-primary">
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-dark-600" />
              <p>Selecciona una conversacion</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
