import webPush from "web-push";
import prisma from "../lib/prisma";

// Initialize VAPID keys (generate once and store in env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@whatsapp-panel.com";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export function getVapidPublicKey() {
  return vapidPublicKey;
}

// Store push subscription
export async function saveSubscription(userId: string, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  // Store as a setting since we don't have a dedicated model yet
  const key = `push_sub_${userId}`;
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(subscription) },
    update: { value: JSON.stringify(subscription) },
  });
}

// Send push notification to a user
export async function sendPushNotification(userId: string, payload: {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return null;
  }

  const key = `push_sub_${userId}`;
  const sub = await prisma.setting.findUnique({ where: { key } });
  if (!sub) return null;

  try {
    const subscription = JSON.parse(sub.value);
    const result = await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/icon-192.png",
        badge: payload.badge || "/icon-192.png",
        tag: payload.tag || "whatsapp-panel",
        data: payload.data || {},
      })
    );
    return result;
  } catch (error: any) {
    // If subscription is expired/invalid, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await prisma.setting.delete({ where: { key } }).catch(() => {});
    }
    console.error("Push notification error:", error.message);
    return null;
  }
}

// Send to all admin users
export async function sendToAdmins(payload: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    admins.map((admin) => sendPushNotification(admin.id, payload))
  );

  return results.filter((r) => r.status === "fulfilled").length;
}

// Send notification for specific events
export async function notifyNewMessage(contactPhone: string, message: string, isHighPriority: boolean = false) {
  const title = isHighPriority ? "🔴 Lead caliente" : "📩 Nuevo mensaje";
  const body = `${contactPhone}: ${message.substring(0, 100)}`;
  return sendToAdmins({ title, body, tag: "new-message", data: { type: "new-message", phone: contactPhone } });
}

export async function notifyLeadAssigned(agentId: string, contactPhone: string) {
  return sendPushNotification(agentId, {
    title: "👤 Lead asignado",
    body: `Se te asigno el lead: ${contactPhone}`,
    tag: "lead-assigned",
    data: { type: "lead-assigned" },
  });
}

export async function notifyDealMoved(dealName: string, stageName: string, value?: number) {
  const valueStr = value ? ` - $${value.toLocaleString()}` : "";
  return sendToAdmins({
    title: "💰 Deal actualizado",
    body: `${dealName} → ${stageName}${valueStr}`,
    tag: "deal-moved",
    data: { type: "deal-moved" },
  });
}

export async function notifyBroadcastComplete(broadcastName: string, sent: number, total: number) {
  return sendToAdmins({
    title: "✅ Broadcast completado",
    body: `${broadcastName}: ${sent}/${total} enviados`,
    tag: "broadcast-complete",
    data: { type: "broadcast-complete" },
  });
}

export async function notifyQualityWarning(phoneNumber: string, rating: string) {
  return sendToAdmins({
    title: "⚠️ Alerta de calidad",
    body: `Numero ${phoneNumber}: calidad ${rating}`,
    tag: "quality-warning",
    data: { type: "quality-warning" },
  });
}
