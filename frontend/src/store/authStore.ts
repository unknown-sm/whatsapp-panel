import { create } from "zustand";
import axios from "axios";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "AGENT";
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  isLoading: false,
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await axios.post("/api/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw error.response?.data?.error || "Error al iniciar sesion";
    }
  },
  logout: () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    set({ user: null, token: null, isAuthenticated: false });
  },
  fetchMe: async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      const { data } = await axios.get("/api/auth/me");
      set({ user: data.user, token, isAuthenticated: true });
    } catch {
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["Authorization"];
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));