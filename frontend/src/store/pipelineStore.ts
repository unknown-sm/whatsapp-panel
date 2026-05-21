import { create } from "zustand";
import api from "../services/api";

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  stages: PipelineStage[];
  _count?: { deals: number };
}

export interface PipelineStage {
  id: string;
  name: string;
  pipelineId: string;
  order: number;
  color: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  currency: string;
  contactId: string | null;
  stageId: string;
  pipelineId: string;
  status: "OPEN" | "WON" | "LOST";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignedToId: string | null;
  expectedCloseDate: string | null;
  source: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  contact: { id: string; name: string | null; phone: string } | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
}

interface PipelineState {
  pipelines: Pipeline[];
  deals: Deal[];
  currentPipeline: Pipeline | null;
  isLoading: boolean;
  error: string | null;
  stats: any;
  fetchPipelines: () => Promise<void>;
  fetchPipeline: (id: string) => Promise<void>;
  createPipeline: (data: Partial<Pipeline>) => Promise<void>;
  createStage: (data: Partial<PipelineStage>) => Promise<void>;
  fetchDeals: (filters?: any) => Promise<void>;
  createDeal: (data: Partial<Deal>) => Promise<void>;
  updateDeal: (id: string, data: Partial<Deal>) => Promise<void>;
  moveDeal: (dealId: string, stageId: string) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  fetchStats: (pipelineId: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelines: [],
  deals: [],
  currentPipeline: null,
  isLoading: false,
  error: null,
  stats: null,

  fetchPipelines: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/pipeline");
      set({ pipelines: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar pipelines", isLoading: false });
    }
  },

  fetchPipeline: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/pipeline/${id}`);
      set({ currentPipeline: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar pipeline", isLoading: false });
    }
  },

  createPipeline: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/pipeline", data);
      await get().fetchPipelines();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear pipeline", isLoading: false });
    }
  },

  createStage: async (data) => {
    try {
      await api.post("/pipeline/stages", data);
      await get().fetchPipelines();
      if (get().currentPipeline) {
        await get().fetchPipeline(get().currentPipeline!.id);
      }
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear etapa" });
    }
  },

  fetchDeals: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/pipeline/deals/all", { params: filters });
      set({ deals: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar deals", isLoading: false });
    }
  },

  createDeal: async (data) => {
    try {
      await api.post("/pipeline/deals", data);
      await get().fetchDeals({ pipelineId: data.pipelineId });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al crear deal" });
    }
  },

  updateDeal: async (id, data) => {
    try {
      await api.patch(`/pipeline/deals/${id}`, data);
      await get().fetchDeals({ pipelineId: get().currentPipeline?.id });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al actualizar deal" });
    }
  },

  moveDeal: async (dealId, stageId) => {
    try {
      await api.post("/pipeline/deals/move", { dealId, stageId });
      set((state) => ({
        deals: state.deals.map((d) => (d.id === dealId ? { ...d, stageId } : d)),
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al mover deal" });
    }
  },

  deleteDeal: async (id) => {
    try {
      await api.delete(`/pipeline/deals/${id}`);
      set((state) => ({ deals: state.deals.filter((d) => d.id !== id) }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al eliminar deal" });
    }
  },

  fetchStats: async (pipelineId: string) => {
    try {
      const res = await api.get(`/pipeline/${pipelineId}/stats`);
      set({ stats: res.data });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Error al cargar stats" });
    }
  },
}));
