"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, api, getToken } from "@/lib/api";

export type Daily = {
  day: string;
  question: string;
  mine: string | null;
  theirs: string | null;
  theyAnswered: boolean;
};

export function useDaily() {
  const [daily, setDaily] = useState<Daily | null>(null);

  useEffect(() => {
    const load = () => api<Daily>("/api/daily").then(setDaily).catch(() => undefined);
    load();
    // The question changes at midnight, so check again when the app comes back.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    const socket = io(API_URL, { auth: { token: getToken() } });
    socket.on("daily:updated", (next: Daily) => setDaily(next));
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.disconnect();
    };
  }, []);

  const answer = useCallback(async (text: string) => {
    const next = await api<Daily>("/api/daily", { method: "POST", body: JSON.stringify({ text }) });
    setDaily(next);
    return next;
  }, []);

  return { daily, answer };
}
