"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import styles from "./ChatsTab.module.css";
import { API_URL, api, getToken, mediaUrl, shownName, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";

interface Props {
  onOpenChat: () => void;
}

type Summary = {
  partner: { id: string; name: string; username?: string; avatarUrl: string } | null;
  expectedPartnerName: string;
  lastMessage: { text?: string; type: string; time: string; senderId: string } | null;
  unread: number;
  streak: number;
  partnerOnline: boolean;
};

type StoryComment = { id: string; name: string; text: string; mine: boolean };

type Story = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  seen: boolean;
  liked?: boolean;
  likeCount?: number;
  comments?: StoryComment[];
};

export default function ChatsTab({ onOpenChat }: Props) {
  const { user, partner, couple, refresh } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [watching, setWatching] = useState<Story | null>(null);
  const [comment, setComment] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh().catch(() => undefined);
    api<Summary>("/api/chat/summary").then(setSummary).catch(() => undefined);
    api<Story[]>("/api/stories").then(setStories).catch(() => undefined);
    const socket = io(API_URL, { auth: { token: getToken() } });
    const apply = (story: Story) => {
      setStories((prev) => prev.some((item) => item.id === story.id) ? prev.map((item) => item.id === story.id ? story : item) : [story, ...prev]);
      setWatching((current) => current && current.id === story.id ? story : current);
    };
    socket.on("story:updated", apply);
    socket.on("story:new", apply);
    return () => { socket.disconnect(); };
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
    setComment("");
    if (!story.seen && String(story.authorId) !== String(user?.id)) {
      api(`/api/stories/${story.id}/seen`, { method: "POST" }).catch(() => undefined);
      setStories((prev) => prev.map((item) => item.id === story.id ? { ...item, seen: true } : item));
    }
  };

  const likeStory = async () => {
    if (!watching) return;
    const story = await api<Story>(`/api/stories/${watching.id}/like`, { method: "POST" }).catch(() => null);
    if (!story) return;
    setWatching(story);
    setStories((prev) => prev.map((item) => item.id === story.id ? story : item));
  };

  const sendComment = async () => {
    if (!watching || !comment.trim()) return;
    const text = comment.trim();
    setComment("");
    const story = await api<Story>(`/api/stories/${watching.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }).catch(() => null);
    if (!story) return;
    setWatching(story);
    setStories((prev) => prev.map((item) => item.id === story.id ? story : item));
  };

  const summaryPartner = summary?.partner && String(summary.partner.id) !== String(user?.id)
    ? shownName(summary.partner)
    : "";
  const invitedName = couple?.expectedPartnerName && couple.expectedPartnerName !== user?.name
    ? couple.expectedPartnerName
    : "";
  const partnerName = shownName(partner) || summaryPartner || invitedName || "My Babe";
  const summaryPhoto = summary?.partner && String(summary.partner.id) !== String(user?.id) ? summary.partner.avatarUrl : "";
  const partnerPhoto = partner?.avatarUrl || summaryPhoto || "";
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
                  : partner?.avatarUrl || summary?.partner?.avatarUrl
                  ? <img src={mediaUrl(partner?.avatarUrl || summary?.partner?.avatarUrl || "")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
            {partnerPhoto ? (
              <img src={mediaUrl(partnerPhoto)} alt="" className={styles.avatar} />
            ) : (
              <div className={styles.avatar} style={{ background: "var(--brand)" }}>
                {partnerName.slice(0, 1)}
              </div>
            )}
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
        <div className={styles.viewer}>
          <button type="button" className={styles.viewerClose} onClick={() => setWatching(null)} aria-label="Close story">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {watching.mediaType === "video"
            ? <video src={mediaUrl(watching.mediaUrl)} className={styles.viewerMedia} autoPlay playsInline />
            : <img src={mediaUrl(watching.mediaUrl)} alt="" className={styles.viewerMedia} />}
          <div className={styles.viewerDock}>
            <div className={styles.viewerComments}>
              {(watching.comments || []).slice(-6).map((item) => (
                <p key={item.id} className={styles.viewerComment}>
                  <strong>{item.mine ? "You" : item.name}</strong>
                  {item.text}
                </p>
              ))}
            </div>
            <form className={styles.viewerRow} onSubmit={(event) => { event.preventDefault(); void sendComment(); }}>
              <input
                className={styles.viewerInput}
                placeholder="Reply to this story"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <button type="submit" className={styles.viewerSend} aria-label="Send comment">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>
              </button>
              <button type="button" className={`${styles.viewerHeart} ${watching.liked ? styles.viewerHeartOn : ""}`} onClick={() => void likeStory()} aria-label="Like story">
                <svg viewBox="0 0 24 24" fill={watching.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {!!watching.likeCount && <span>{watching.likeCount}</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

