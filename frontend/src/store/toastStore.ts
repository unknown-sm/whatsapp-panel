import { create } from "zustand";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 4000;
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }));
    setTimeout(() => get().dismiss(id), duration);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (message, description) => get().show({ message, description, variant: "success" }),
  error: (message, description) => get().show({ message, description, variant: "error", duration: 6000 }),
  warning: (message, description) => get().show({ message, description, variant: "warning" }),
  info: (message, description) => get().show({ message, description, variant: "info" }),
}));