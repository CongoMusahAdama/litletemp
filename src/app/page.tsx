"use client";

import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import LoginScreen from "@/components/LoginScreen";
import AppShell from "@/components/AppShell";

type Screen = "splash" | "login" | "app";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");

  if (screen === "splash") {
    return <SplashScreen onContinue={() => setScreen("login")} />;
  }

  if (screen === "login") {
    return <LoginScreen onLogin={() => setScreen("app")} />;
  }

  return <AppShell />;
}