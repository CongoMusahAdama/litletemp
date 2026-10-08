import { api } from "./api";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function badgeNavigator() {
  return navigator as BadgeNavigator;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerAppWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function clearHomeBadge() {
  const nav = badgeNavigator();
  if (nav.clearAppBadge) await nav.clearAppBadge().catch(() => undefined);
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: "clear-badge" });
}

export async function showHomeBadge() {
  const summary = await api<{ unread: number }>("/api/chat/summary").catch(() => null);
  const unread = summary?.unread || 0;
  const nav = badgeNavigator();
  if (!nav.setAppBadge) return;
  if (unread > 0) await nav.setAppBadge(unread).catch(() => undefined);
  else await clearHomeBadge();
}

export async function enableHomeBadge() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await registerAppWorker();
  if (!registration) return false;
  const { publicKey } = await api<{ publicKey: string }>("/api/push/key");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
  return true;
}
