"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { scopedSocket } from "@/lib/socket";
import { isEvening, localDay } from "@/lib/day";

export type RecapEntry = { rating: number; text: string; at: string } | null;
export type Recap = { day: string; mine: RecapEntry; theirs: RecapEntry; theyShared: boolean };

/** Today's evening check-in for both of you, kept fresh while the app is open. */
export function useRecap() {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [evening, setEvening] = useState(false);

  useEffect(() => {
    const load = () => {
      setEvening(isEvening());
      api<Recap>(`/api/recap?day=${localDay()}`).then(setRecap).catch(() => undefined);
    };
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    // Pick up 5pm (and midnight) without needing to reopen the app.
    const timer = window.setInterval(load, 10 * 60 * 1000);
    const socket = scopedSocket();
    socket.on("recap:updated", (next: Recap) => { if (next.day === localDay()) setRecap(next); });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, []);

  const share = useCallback(async (rating: number, text: string) => {
    const next = await api<Recap>("/api/recap", { method: "POST", body: JSON.stringify({ day: localDay(), rating, text }) });
    setRecap(next);
    return next;
  }, []);

  return { recap, evening, share };
}
