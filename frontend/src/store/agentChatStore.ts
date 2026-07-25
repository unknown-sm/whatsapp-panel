import { create } from "zustand";
import api from "../services/api";
import { io, Socket } from "socket.io-client";

export interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ChatConversation {
  user: AgentUser;
  lastMessage: { id: string; content: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
}

export interface AgentMsg {
  id: string;
  senderId: string;
  recipientId: string | null;
  conversationId: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string } | null;
  conversation: { id: string; contact: { name: string; phone: string } } | null;
}

interface AgentChatState {
  isOpen: boolean;
  conversations: ChatConversation[];
  messages: AgentMsg[];
  activePartner: AgentUser | null;
  unreadTotal: number;
  loading: boolean;
  socket: Socket | null;

  toggle: () => void;
  open: () => void;
  close: () => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (partnerId: string) => Promise<void>;
  selectPartner: (user: AgentUser) => void;
  clearPartner: () => void;
  sendMessage: (content: string, conversationId?: string) => Promise<void>;
  fetchUnread: () => Promise<void>;
  connectSocket: (token: string) => void;
  addIncomingMessage: (msg: AgentMsg) => void;
  disconnectSocket: () => void;
}

export const useAgentChatStore = create<AgentChatState>((set, get) => ({
  isOpen: false,
  conversations: [],
  messages: [],
  activePartner: null,
  unreadTotal: 0,
  loading: false,
  socket: null,

  toggle: () => {
    const next = !get().isOpen;
    set({ isOpen: next });
    if (next) get().fetchConversations();
  },
  open: () => {
    set({ isOpen: true });
    get().fetchConversations();
  },
  close: () => set({ isOpen: false }),

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get("/api/agent-chat/conversations");
      set({ conversations: Array.isArray(data) ? data : [] });
    } catch (err) { console.error("agentChat fetchConvs:", err); } finally { set({ loading: false }); }
  },

  fetchMessages: async (partnerId: string) => {
    try {
      const { data } = await api.get(`/api/agent-chat/conversations/${partnerId}`);
      set({ messages: Array.isArray(data) ? data : [] });
      get().fetchConversations();
      get().fetchUnread();
    } catch (err) { console.error("agentChat fetchMsgs:", err); }
  },

  selectPartner: (user) => {
    set({ activePartner: user });
    get().fetchMessages(user.id);
  },

  clearPartner: () => set({ activePartner: null, messages: [] }),

  sendMessage: async (content, conversationId) => {
    const { activePartner } = get();
    if (!activePartner) return;
    try {
      const { data } = await api.post("/api/agent-chat/send", {
        recipientId: activePartner.id,
        content,
        conversationId: conversationId || undefined,
      });
      set((s) => ({ messages: [...s.messages, data] }));
      get().fetchConversations();

      // Emit via socket
      const socket = get().socket;
      if (socket) {
        socket.emit("agent-chat:message", data);
      }
    } catch (err) { console.error("agentChat send:", err); }
  },

  fetchUnread: async () => {
    try {
      const { data } = await api.get("/api/agent-chat/unread-count");
      set({ unreadTotal: data.count || 0 });
    } catch (err) { console.error("agentChat unread:", err); }
  },

  connectSocket: (token) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    const socket = io(import.meta.env.VITE_API_URL || "", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Agent chat socket connected");
      get().fetchUnread();
    });

    socket.on("agent-chat:received", (msg: AgentMsg) => {
      get().addIncomingMessage(msg);
    });

    set({ socket });
  },

  addIncomingMessage: (msg) => {
    const { activePartner, isOpen } = get();
    // If chat is open with the sender, add to messages
    if (isOpen && activePartner && msg.senderId === activePartner.id) {
      set((s) => ({ messages: [...s.messages, msg] }));
      // Mark as read
      api.put(`/api/agent-chat/read/${msg.senderId}`).catch(() => {});
    }
    get().fetchUnread();
    get().fetchConversations();
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) socket.disconnect();
    set({ socket: null });
  },
}));
