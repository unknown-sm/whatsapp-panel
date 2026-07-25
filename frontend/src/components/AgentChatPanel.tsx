import { useEffect, useRef, useState } from "react";
import { useAgentChatStore } from "../store/agentChatStore";
import { X, ArrowLeft, Send, MessageSquare, User } from "lucide-react";

export default function AgentChatPanel() {
  const { isOpen, close, conversations, messages, activePartner, unreadTotal, loading, fetchConversations, selectPartner, clearPartner, sendMessage } = useAgentChatStore();
  const [input, setInput] = useState("");
  const msgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) fetchConversations();
  }, [isOpen]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex" style={{ width: 380 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={close} />

      <div className="relative z-40 w-full h-full flex flex-col border-l shadow-2xl" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-default)" }}>
          {activePartner ? (
            <>
              <button onClick={clearPartner} className="p-1 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                <ArrowLeft size={18} />
              </button>
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{activePartner.name}</span>
              <button onClick={close} className="p-1 rounded transition-colors" style={{ color: "var(--text-tertiary)" }}>
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MessageSquare size={18} style={{ color: "var(--accent)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Chat interno</span>
                {unreadTotal > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--danger)", color: "#fff" }}>{unreadTotal}</span>
                )}
              </div>
              <button onClick={close} className="p-1 rounded transition-colors" style={{ color: "var(--text-tertiary)" }}>
                <X size={18} />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {activePartner ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>Cargando...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>Sin mensajes aun</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId !== activePartner.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isMine ? "rounded-br-sm" : "rounded-bl-sm"}`}
                        style={{ background: isMine ? "var(--accent-muted)" : "var(--bg-muted)" }}>
                        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--text-primary)" }}>{msg.content}</p>
                        {msg.conversation && (
                          <p className="text-[10px] mt-1 opacity-60" style={{ color: "var(--text-secondary)" }}>
                            Re: {msg.conversation.contact.name}
                          </p>
                        )}
                        <p className="text-[9px] mt-1 text-right opacity-50" style={{ color: "var(--text-tertiary)" }}>
                          {new Date(msg.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgsEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Escribi un mensaje..."
                  style={{ background: "var(--bg-muted)", color: "var(--text-primary)", maxHeight: 100 }}
                />
                <button onClick={handleSend} disabled={!input.trim()}
                  className="p-2 rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Agent list */
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-center p-4" style={{ color: "var(--text-tertiary)" }}>Cargando...</p>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-center p-4" style={{ color: "var(--text-tertiary)" }}>No hay otros agentes</p>
            ) : (
              conversations.map((conv) => (
                <button key={conv.user.id} onClick={() => selectPartner(conv.user)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b transition-colors hover:opacity-80 text-left"
                  style={{ borderColor: "var(--border-default)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                    {(conv.user.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{conv.user.name}</span>
                      {conv.lastMessage && (
                        <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: "var(--text-tertiary)" }}>
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      {conv.lastMessage ? (
                        <span className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                          {conv.lastMessage.fromMe && "Tu: "}{conv.lastMessage.content}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{conv.user.email}</span>
                      )}
                      {conv.unread > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2"
                          style={{ background: "var(--danger)", color: "#fff", minWidth: 18, textAlign: "center" }}>
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
