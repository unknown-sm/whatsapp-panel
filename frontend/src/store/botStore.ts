import { create } from "zustand";
import api from "../services/api";

interface Bot {
  id: string;
  name: string;
  exactMatch: boolean;
  isActive: boolean;
  createdAt: string;
  keywords: { id: string; keyword: string }[];
  _count?: { flowSteps: number; conversations: number };
}

interface BotState {
  bots: Bot[];
  selectedBot: Bot | null;
  isLoading: boolean;
  fetchBots: () => Promise<void>;
  createBot: (data: { name: string; exactMatch?: boolean; keywords?: string[] }) => Promise<Bot>;
  updateBot: (id: string, data: { name?: string; exactMatch?: boolean; isActive?: boolean }) => Promise<Bot>;
  deleteBot: (id: string) => Promise<void>;
  addKeyword: (botId: string, keyword: string) => Promise<void>;
  removeKeyword: (botId: string, keywordId: string) => Promise<void>;
  selectBot: (bot: Bot | null) => void;
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
}));