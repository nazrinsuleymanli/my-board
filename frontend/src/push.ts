import { api } from "./api";

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: "insecure" | "not-installed" | "unsupported" | "denied" };

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (isIOS() && !isStandalone()) return { ok: false, reason: "not-installed" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return { ok: false, reason: "unsupported" };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };
  return { ok: true };
}

const toBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function enablePush(): Promise<void> {
  const perm = await Notification.requestPermission(); // must be called from a tap
  if (perm !== "granted") throw new Error("Notifications were not allowed");
  const reg = await navigator.serviceWorker.ready;
  const { public_key } = await api.pushKey();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(public_key) }));
  await api.pushSubscribe(sub.toJSON());
}

export async function isSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(reg && (await reg.pushManager.getSubscription()));
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}
