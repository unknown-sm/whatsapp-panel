import { create } from "zustand";
import api from "../services/api";

export interface BroadcastTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  isActive: boolean;
}

export interface Broadcast {
  id: string;
  name: string;
  templateId: string | null;
  content: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
  scheduledAt: string | null;
  sentAt: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  template?: BroadcastTemplate;
}

interface BroadcastState {
  broadcasts: Broadcast[];
  templates: BroadcastTemplate[];
  isLoading: boolean;
  error: string | null;
  fetchBroadcasts: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createBroadcast: (data: any) => Promise<void>;
  createTemplate: (data: any) => Promise<void>;
  sendBroadcast: (id: string) => Promise<void>;
  deleteBroadcast: (id: string) => Promise<void>;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  broadcasts: [],
  templates: [],
  isLoading: false,
  error: null,

  fetchBroadcasts: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/api/broadcast");
      set({ broadcasts: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar broadcasts", isLoading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      const res = await api.get("/api/broadcast/templates");
      set({ templates: res.data });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar templates" });
    }
  },

  createBroadcast: async (data) => {
    try {
      await api.post("/api/broadcast", data);
      await get().fetchBroadcasts();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear broadcast" });
    }
  },

  createTemplate: async (data) => {
    try {
      await api.post("/api/broadcast/templates", data);
      await get().fetchTemplates();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear template" });
    }
  },

  sendBroadcast: async (id) => {
    try {
      await api.post(`/api/broadcast/${id}/send`);
      await get().fetchBroadcasts();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al enviar broadcast" });
    }
  },

  deleteBroadcast: async (id) => {
    try {
      await api.delete(`/api/broadcast/${id}`);
      set((state) => ({ broadcasts: state.broadcasts.filter((b) => b.id !== id) }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al eliminar broadcast" });
    }
  },
}));
