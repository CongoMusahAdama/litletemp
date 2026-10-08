"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ChatsTab.module.css";
import { api, mediaUrl, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";

interface Props {
  onOpenChat: () => void;
}

type Summary = {
  partner: { id: string; name: string; avatarUrl: string } | null;
  expectedPartnerName: string;
  lastMessage: { text?: string; type: string; time: string; senderId: string } | null;
  unread: number;
  streak: number;
  partnerOnline: boolean;
};

type Story = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  seen: boolean;
};

export default function ChatsTab({ onOpenChat }: Props) {
  const { user, couple } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [watching, setWatching] = useState<Story | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Summary>("/api/chat/summary").then(setSummary).catch(() => undefined);
    api<Story[]>("/api/stories").then(setStories).catch(() => undefined);
  }, []);

  const mine = stories.filter((story) => String(story.authorId) === String(user?.id));
  const theirs = stories.filter((story) => String(story.authorId) !== String(user?.id));

  const addStory = async (file: File) => {
    setAdding(true);
    try {
      const uploaded = await uploadFile(file);
      const story = await api<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaUrl: uploaded.url,
          mediaType: file.type.startsWith("video") ? "video" : "image",
        }),
      });
      setStories((prev) => [story, ...prev]);
    } finally {
      setAdding(false);
    }
  };

  const openStory = (story: Story) => {
    setWatching(story);
    if (!story.seen && String(story.authorId) !== String(user?.id)) {
      api(`/api/stories/${story.id}/seen`, { method: "POST" }).catch(() => undefined);
      setStories((prev) => prev.map((item) => item.id === story.id ? { ...item, seen: true } : item));
    }
  };

  const partnerName = summary?.partner?.name || couple?.expectedPartnerName || "My Babe";
  const preview = summary?.lastMessage
    ? (summary.lastMessage.text || `[${summary.lastMessage.type}]`)
    : "Say something sweet";
  return (
    <div className={styles.tab}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Chats</h1>
        <button id="btn-new-chat" className={styles.newBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </header>

      {/* Stories Row */}
      <div className={styles.storiesWrap}>
        <div className={styles.storiesScroll}>
          {/* Add story */}
          <button className={styles.storyItem} onClick={() => fileRef.current?.click()} disabled={adding}>
            <div className={styles.storyAddBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className={styles.storyName}>{adding ? "Adding..." : "Add story"}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) addStory(file);
            }}
          />

          {mine[0] && (
            <button className={styles.storyItem} onClick={() => openStory(mine[0])}>
              <div className={`${styles.storyRing} ${styles.storyUnseen}`}>
                <div className={styles.storyAvatar} style={{ background: "#1a1a1a", overflow: "hidden" }}>
                  {mine[0].mediaType === "video"
                    ? <span>▶</span>
                    : <img src={mediaUrl(mine[0].mediaUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
              </div>
              <span className={styles.storyName}>My story</span>
            </button>
          )}

          <button className={styles.storyItem} onClick={() => theirs[0] ? openStory(theirs[0]) : onOpenChat()}>
            <div className={`${styles.storyRing} ${theirs[0] && !theirs[0].seen ? styles.storyUnseen : ""}`}>
              <div className={styles.storyAvatar} style={{ background: "var(--brand)", overflow: "hidden" }}>
                {theirs[0] && theirs[0].mediaType === "image"
                  ? <img src={mediaUrl(theirs[0].mediaUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : summary?.partner?.avatarUrl
                  ? <img src={mediaUrl(summary.partner.avatarUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span>{partnerName.slice(0, 1)}</span>}
              </div>
            </div>
            <span className={styles.storyName}>{partnerName}</span>
          </button>
        </div>
      </div>

      {/* Single chat entry — My Babe */}
      <div className={styles.list}>
        <button id="btn-chat-1" className={styles.chatItem} onClick={onOpenChat}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar} style={{ background: "var(--brand)" }}>
              {partnerName.slice(0, 1)}
            </div>
            {summary?.partnerOnline && <span className={styles.onlineDot} />}
          </div>

          <div className={styles.chatContent}>
            <div className={styles.topRow}>
              <span className={styles.chatName}>
                {partnerName}
                <span className={styles.streak}>🔥 {summary?.streak ?? couple?.currentStreak ?? 0}</span>
              </span>
              <span className={`${styles.time} ${summary?.unread ? styles.timeUnread : ""}`}>{summary?.lastMessage?.time || ""}</span>
            </div>
            <div className={styles.bottomRow}>
              <span className={styles.lastMsg}>{preview}</span>
              {!!summary?.unread && <span className={styles.badge}>{summary.unread}</span>}
            </div>
          </div>
        </button>
      </div>

      {watching && (
        <div className={styles.viewer} onClick={() => setWatching(null)}>
          {watching.mediaType === "video"
            ? <video src={mediaUrl(watching.mediaUrl)} className={styles.viewerMedia} autoPlay controls onClick={(event) => event.stopPropagation()} />
            : <img src={mediaUrl(watching.mediaUrl)} alt="" className={styles.viewerMedia} />}
          <p className={styles.viewerNote}>This story disappears after 24 hours</p>
        </div>
      )}
    </div>
  );
}

