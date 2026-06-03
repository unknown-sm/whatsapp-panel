import { create } from "zustand";
import api from "../services/api";

interface Bot {
  id: string;
  name: string;
  systemPrompt: string | null;
  exactMatch: boolean;
  isActive: boolean;
  createdAt: string;
  keywords: { id: string; keyword: string }[];
  _count?: { flowSteps: number; conversations: number };
}

interface KnowledgeEntry {
  id: string;
  botId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface BotState {
  bots: Bot[];
  selectedBot: Bot | null;
  isLoading: boolean;
  fetchBots: () => Promise<void>;
  createBot: (data: { name: string; systemPrompt?: string; exactMatch?: boolean; keywords?: string[] }) => Promise<Bot>;
  updateBot: (id: string, data: { name?: string; systemPrompt?: string | null; exactMatch?: boolean; isActive?: boolean }) => Promise<Bot>;
  deleteBot: (id: string) => Promise<void>;
  addKeyword: (botId: string, keyword: string) => Promise<void>;
  removeKeyword: (botId: string, keywordId: string) => Promise<void>;
  selectBot: (bot: Bot | null) => void;
  getKnowledge: (botId: string) => Promise<KnowledgeEntry[]>;
  uploadKnowledge: (botId: string, file: File) => Promise<KnowledgeEntry>;
  deleteKnowledge: (botId: string, id: string) => Promise<void>;
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: [],
  selectedBot: null,
  isLoading: false,

  fetchBots: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/api/bots");
      set({ bots: data.bots, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createBot: async (data) => {
    const { data: res } = await api.post("/api/bots", data);
    set((state) => ({ bots: [res.bot, ...state.bots] }));
    return res.bot;
  },

  updateBot: async (id, data) => {
    const { data: res } = await api.put(`/api/bots/${id}`, data);
    set((state) => ({
      bots: state.bots.map((b) => (b.id === id ? res.bot : b)),
      selectedBot: state.selectedBot?.id === id ? res.bot : state.selectedBot,
    }));
    return res.bot;
  },

  deleteBot: async (id) => {
    await api.delete(`/api/bots/${id}`);
    set((state) => ({
      bots: state.bots.filter((b) => b.id !== id),
      selectedBot: state.selectedBot?.id === id ? null : state.selectedBot,
    }));
  },

  addKeyword: async (botId, keyword) => {
    await api.post(`/api/bots/${botId}/keywords`, { keyword });
    get().fetchBots();
  },

  removeKeyword: async (botId, keywordId) => {
    await api.delete(`/api/bots/${botId}/keywords/${keywordId}`);
    get().fetchBots();
  },

  selectBot: (bot) => set({ selectedBot: bot }),

  getKnowledge: async (botId) => {
    const { data } = await api.get(`/api/bots/${botId}/knowledge`);
    return data.entries;
  },

  uploadKnowledge: async (botId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post(`/api/bots/${botId}/knowledge`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.entry;
  },

  deleteKnowledge: async (botId, id) => {
    await api.delete(`/api/bots/${botId}/knowledge/${id}`);
  },
}));