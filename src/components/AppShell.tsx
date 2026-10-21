"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scopedSocket } from "@/lib/socket";
import BottomNav from "./BottomNav";
import ChatsTab from "./tabs/ChatsTab";
import JournalTab from "./tabs/JournalTab";
import MoodTab from "./tabs/MoodTab";
import MoreTab from "./tabs/MoreTab";
import ChatView from "./ChatView";
import styles from "./AppShell.module.css";
import { useSession } from "@/context/SessionContext";
import { api, PublicUser } from "@/lib/api";
import { applyBubble } from "@/lib/bubbles";
import { playMessageNote } from "@/lib/note";
import HomeBadge from "./HomeBadge";
import { MoodPopup, PairingBoard, PasswordSetup } from "./CoupleOverlays";
import HeartBurst from "./HeartBurst";

export type Tab = "chats" | "journal" | "mood" | "more" | "action";

export default function AppShell() {
  const { user, couple, partner, refresh, markJoined } = useSession();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [chatOpen, setChatOpen] = useState(true); // open chat immediately
  const [triggerEntry, setTriggerEntry] = useState(0);
  const [covered, setCovered] = useState(false);
  const [nudge, setNudge] = useState<{ name: string; emoji: string; at: number } | null>(null);
  const clearNudge = useCallback(() => setNudge(null), []);
  // Unread messages for the number on the Chats tab.
  const [unread, setUnread] = useState(0);
  const loadUnread = useCallback(() => {
    api<{ unread: number }>("/api/chat/summary").then((summary) => setUnread(summary.unread || 0)).catch(() => undefined);
  }, []);

  // Closing the chat (it marks messages read) or coming back to the app refreshes the count.
  useEffect(() => {
    if (!user?.id || chatOpen) return;
    loadUnread();
    const onVisible = () => { if (document.visibilityState === "visible") loadUnread(); };
    document.addEventListener("visibilitychange", onVisible);
    const socket = scopedSocket();
    socket.on("message:new", loadUnread);
    socket.on("messages:read", loadUnread);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.disconnect();
    };
  }, [user?.id, chatOpen, loadUnread]);

  useEffect(() => {
    const saved = user?.bubbleColor || localStorage.getItem("lt_bubble") || "";
    applyBubble(saved);
  }, [user?.bubbleColor]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = scopedSocket();
    const pull = () => { refreshRef.current().catch(() => undefined); };
    socket.on("connect", pull);
    socket.on("partner:updated", pull);
    socket.on("nudge", (payload: { name: string; emoji: string; at: number }) => setNudge(payload));
    socket.on("partner:joined", (payload: { partner?: PublicUser }) => {
      if (payload?.partner) markJoined(payload.partner);
      pull();
    });
    return () => { socket.disconnect(); };
  }, [user?.id, markJoined]);

  useEffect(() => {
    const onNote = (event: MessageEvent) => {
      if (event.data?.type === "message-note") playMessageNote();
    };
    navigator.serviceWorker?.addEventListener("message", onNote);
    return () => navigator.serviceWorker?.removeEventListener("message", onNote);
  }, []);

  useEffect(() => {
    const sync = () => setCovered(document.visibilityState !== "visible");
    const hide = () => setCovered(true);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
    };
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (tab === "action") {
      setActiveTab("journal");
      setTriggerEntry(Date.now());
      return;
    }
    setActiveTab(tab);
    // When switching away and back to chats, reopen chat directly
    if (tab === "chats") setChatOpen(true);
  };

  return (
    <div className={styles.shell}>
      <main className={`${styles.main} ${!chatOpen ? styles.mainWithNav : ""}`}>
        {activeTab === "chats" && !chatOpen && (
          <ChatsTab onOpenChat={() => setChatOpen(true)} />
        )}
        {activeTab === "chats" && chatOpen && (
          <ChatView onBack={() => setChatOpen(false)} />
        )}
        {activeTab === "journal" && <JournalTab triggerNewEntry={triggerEntry} />}
        {activeTab === "mood" && <MoodTab />}
        {activeTab === "more" && <MoreTab />}
      </main>

      {/* Bottom nav hidden inside full-screen chat */}
      {!chatOpen && (
        <BottomNav active={activeTab} onChange={handleTabChange} unread={unread} />
      )}
      <HomeBadge />
      {couple?.status === "pending" && couple.gatePassword && !partner && <PairingBoard />}
      {(couple?.status === "active" || partner) && user && !user.hasPassword && <PasswordSetup />}
      {couple?.status === "active" && user?.hasPassword && <MoodPopup />}
      {nudge && <HeartBurst key={nudge.at} name={nudge.name} emoji={nudge.emoji} onDone={clearNudge} />}
      {covered && <div className={styles.privacyCover}>Little Temptation</div>}
    </div>
  );
}
