"use client";

import { useEffect, useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/components/LoginScreen";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";

type Screen = "splash" | "login" | "app";

export default function Home() {
  const { user, ready, offline, refresh } = useSession();
  const [screen, setScreen] = useState<Screen>("splash");

  useEffect(() => {
    if (!ready || screen === "splash") return;
    setScreen(user ? "app" : "login");
  }, [ready, user, screen]);

  if (screen === "splash" || !ready) {
    return <SplashScreen onContinue={() => setScreen(user ? "app" : "login")} />;
  }

  if (!user && offline) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "#fff6d4", color: "#1a1a1a" }}>
        <div>
          <h1 style={{ fontSize: 32, letterSpacing: "-0.04em" }}>Still connecting</h1>
          <p style={{ margin: "12px 0 20px" }}>Your bond is safe. The server is waking up.</p>
          <button type="button" onClick={() => { refresh().catch(() => undefined); }} style={{ border: 0, borderRadius: 999, padding: "12px 18px", background: "#1a1a1a", color: "#fff6d4", font: "inherit" }}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (screen === "login") {
    return <LoginScreen onLogin={() => setScreen("app")} />;
  }

  return <AppShell />;
}
