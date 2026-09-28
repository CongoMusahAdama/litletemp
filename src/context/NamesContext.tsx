"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface NamesType {
  myName: string;
  partnerName: string;
}

interface NamesContextType extends NamesType {
  setMyName: (n: string) => void;
  setPartnerName: (n: string) => void;
}

const NamesContext = createContext<NamesContextType | undefined>(undefined);

export function NamesProvider({ children }: { children: ReactNode }) {
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lt_names");
      if (saved) {
        const data: NamesType = JSON.parse(saved);
        if (data.myName) setMyName(data.myName);
        if (data.partnerName) setPartnerName(data.partnerName);
      }
    } catch {}
  }, []);

  // Persist whenever names change
  useEffect(() => {
    try {
      localStorage.setItem("lt_names", JSON.stringify({ myName, partnerName }));
    } catch {}
  }, [myName, partnerName]);

  return (
    <NamesContext.Provider value={{ myName, partnerName, setMyName, setPartnerName }}>
      {children}
    </NamesContext.Provider>
  );
}

export function useNames() {
  const context = useContext(NamesContext);
  if (!context) throw new Error("useNames must be used within NamesProvider");
  return context;
}