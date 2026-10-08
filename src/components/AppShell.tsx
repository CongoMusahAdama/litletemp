"use client";

import { useState } from "react";
import BottomNav from "./BottomNav";
import ChatsTab from "./tabs/ChatsTab";
import JournalTab from "./tabs/JournalTab";
import MoodTab from "./tabs/MoodTab";
import MoreTab from "./tabs/MoreTab";
import ChatView from "./ChatView";
import styles from "./AppShell.module.css";

export type Tab = "chats" | "journal" | "mood" | "more" | "action";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [chatOpen, setChatOpen] = useState(true); // open chat immediately
  const [triggerEntry, setTriggerEntry] = useState(0);

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
        <BottomNav active={activeTab} onChange={handleTabChange} />
      )}
    </div>
  );
}
