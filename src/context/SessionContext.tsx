"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, clearToken, getToken, PublicUser, CoupleInfo, setToken } from "@/lib/api";

type Session = {
  user: PublicUser | null;
  partner: PublicUser | null;
  couple: CoupleInfo | null;
  ready: boolean;
  refresh: () => Promise<void>;
  saveSession: (token: string) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<Session | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [partner, setPartner] = useState<PublicUser | null>(null);
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setPartner(null);
      setCouple(null);
      return;
    }
    const data = await api<{ user: PublicUser; partner: PublicUser | null; couple: CoupleInfo | null }>("/api/auth/me");
    setUser(data.user);
    setPartner(data.partner);
    setCouple(data.couple);
  };

  const saveSession = async (token: string) => {
    setToken(token);
    await refresh();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setPartner(null);
    setCouple(null);
  };

  useEffect(() => {
    refresh()
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  return (
    <SessionContext.Provider value={{ user, partner, couple, ready, refresh, saveSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
