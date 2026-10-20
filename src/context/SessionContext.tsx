"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { ApiError, api, clearToken, getToken, PublicUser, CoupleInfo, setToken } from "@/lib/api";
import { closeSocket } from "@/lib/socket";
import { clearChatCache } from "@/lib/chatCache";
import { useTheme } from "@/context/ThemeContext";

type Session = {
  user: PublicUser | null;
  partner: PublicUser | null;
  couple: CoupleInfo | null;
  ready: boolean;
  offline: boolean;
  refresh: (signal?: AbortSignal) => Promise<void>;
  markJoined: (partner: PublicUser) => void;
  saveSession: (token: string) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<Session | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [partner, setPartner] = useState<PublicUser | null>(null);
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!getToken()) {
      setUser(null);
      setPartner(null);
      setCouple(null);
      setOffline(false);
      return;
    }
    const data = await api<{ user: PublicUser; partner: PublicUser | null; couple: CoupleInfo | null }>("/api/auth/me", { signal });
    setOffline(false);
    setUser(data.user);
    setPartner(data.partner);
    setCouple(data.couple);
  }, []);

  const markJoined = useCallback((nextPartner: PublicUser) => {
    setPartner(nextPartner);
    setCouple((current) => (current ? { ...current, status: "active", gatePassword: "" } : current));
  }, []);

  const saveSession = async (token: string) => {
    setToken(token);
    setOffline(false);
    await refresh();
  };

  const logout = () => {
    clearToken();
    closeSocket();
    clearChatCache();
    setUser(null);
    setPartner(null);
    setCouple(null);
    setOffline(false);
  };

  useEffect(() => {
    let gone = false;
    const boot = () => {
      refresh()
        .catch((error) => {
          if (gone) return;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            clearToken();
            closeSocket();
            clearChatCache();
            setUser(null);
            setPartner(null);
            setCouple(null);
            setOffline(false);
            return;
          }
          if (getToken()) setOffline(true);
        })
        .finally(() => {
          if (!gone) setReady(true);
        });
    };
    boot();
    const onWake = () => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [refresh]);

  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") setTheme(user.theme);
  }, [user?.theme, setTheme]);

  return (
    <SessionContext.Provider value={{ user, partner, couple, ready, offline, refresh, markJoined, saveSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
