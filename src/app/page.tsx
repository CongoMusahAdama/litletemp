"use client";

import { useEffect, useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/components/LoginScreen";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";

type Screen = "splash" | "login" | "app";

export default function Home() {
  const { user, ready } = useSession();
  const [screen, setScreen] = useState<Screen>("splash");

  useEffect(() => {
    if (!ready || screen === "splash") return;
    setScreen(user ? "app" : "login");
  }, [ready, user, screen]);

  if (screen === "splash" || !ready) {
    return <SplashScreen onContinue={() => setScreen(user ? "app" : "login")} />;
  }

  if (screen === "login") {
    return <LoginScreen onLogin={() => setScreen("app")} />;
  }

  return <AppShell />;
}
