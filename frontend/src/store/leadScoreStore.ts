import { create } from "zustand";
import api from "../services/api";

export interface LeadScoreRule {
  id: string;
  name: string;
  condition: string;
  config: any;
  points: number;
  isActive: boolean;
  _count?: { scores: number };
}

export interface LeaderboardEntry {
  contactId: string;
  totalPoints: number;
  activityCount: number;
  contact: { id: string; name: string | null; phone: string } | null;
}

interface LeadScoreState {
  rules: LeadScoreRule[];
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  fetchRules: () => Promise<void>;
  createRule: (data: Partial<LeadScoreRule>) => Promise<void>;
  updateRule: (id: string, data: Partial<LeadScoreRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  recalculate: () => Promise<void>;
}

export const useLeadScoreStore = create<LeadScoreState>((set, get) => ({
  rules: [],
  leaderboard: [],
  isLoading: false,
  error: null,

  fetchRules: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/api/leadscore/rules");
      set({ rules: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar reglas", isLoading: false });
    }
  },

  createRule: async (data) => {
    try {
      await api.post("/api/leadscore/rules", data);
      await get().fetchRules();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear regla" });
    }
  },

  updateRule: async (id, data) => {
    try {
      await api.patch(`/api/leadscore/rules/${id}`, data);
      await get().fetchRules();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al actualizar regla" });
    }
  },

  deleteRule: async (id) => {
    try {
      await api.delete(`/api/leadscore/rules/${id}`);
      set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al eliminar regla" });
    }
  },

  fetchLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/api/leadscore/leaderboard");
      set({ leaderboard: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar leaderboard", isLoading: false });
    }
  },

  recalculate: async () => {
    set({ isLoading: true });
    try {
      await api.post("/api/leadscore/recalculate");
      await get().fetchLeaderboard();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al recalcular", isLoading: false });
    }
  },
}));
