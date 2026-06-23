import { create } from "zustand";
import api from "../services/api";

interface NotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  isSupported: typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
  isSubscribed: false,
  permission: typeof Notification !== "undefined" ? Notification.permission : "default",

  requestPermission: async () => {
    if (typeof Notification === "undefined") return "denied";
    const permission = await Notification.requestPermission();
    set({ permission });
    return permission;
  },

  subscribe: async () => {
    try {
      const permission = await get().requestPermission();
      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const { data } = await api.get("/api/push/vapid-key");
      if (!data.publicKey) return false;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const subJson = subscription.toJSON();

      await api.post("/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });

      set({ isSubscribed: true });
      return true;
    } catch (error) {
      console.error("Push subscription error:", error);
      return false;
    }
  },

  unsubscribe: async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await api.post("/api/push/unsubscribe", { endpoint: subscription.endpoint });
      }
      set({ isSubscribed: false });
    } catch (error) {
      console.error("Push unsubscription error:", error);
    }
  },
}));
