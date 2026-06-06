import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { UpcomingNotification } from "../types";
import { minutesUntilLabel } from "./dateUtils";

const POLL_INTERVAL_MS = 30_000;

export type VisitToast = UpcomingNotification & { toastKey: number };

function showBrowserNotification(item: UpcomingNotification): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const body = `${item.patient_name} — ${minutesUntilLabel(item.minutes_until)}`;
  try {
    const n = new Notification("Скоро приём", {
      body,
      tag: `visit-${item.consultation_id}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore unsupported environments */
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

export function useUpcomingVisitNotifications(token: string | null) {
  const [toasts, setToasts] = useState<VisitToast[]>([]);
  const shownRef = useRef(new Set<number>());

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const items = await api.upcomingNotifications(token);
      for (const item of items) {
        if (shownRef.current.has(item.consultation_id)) continue;
        shownRef.current.add(item.consultation_id);
        showBrowserNotification(item);
        setToasts((prev) => [
          ...prev,
          { ...item, toastKey: item.consultation_id },
        ]);
      }
    } catch (e) {
      console.warn("[notifications] poll failed:", e);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void requestNotificationPermission();
    void poll();
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    const onFocus = () => void poll();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, poll]);

  const dismissToast = useCallback((toastKey: number) => {
    setToasts((prev) => prev.filter((t) => t.toastKey !== toastKey));
  }, []);

  return { toasts, dismissToast };
}
