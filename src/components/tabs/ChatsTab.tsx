"use client";

import { useEffect, useRef, useState } from "react";
import { scopedSocket } from "@/lib/socket";
import styles from "./ChatsTab.module.css";
import { api, mediaUrl, shownName, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useDaily } from "@/hooks/useDaily";
import DailyQuestion from "../DailyQuestion";
import OnThisDay from "../OnThisDay";
import { sendNudge } from "../HeartBurst";
import { clockTime, dayLabel, listTime } from "@/lib/chatDates";
import { createPortal } from "react-dom";
import FootballScreen from "../FootballScreen";

type MatchDay = {
  id: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished" | "off";
  clock: string;
  home: { id: string; short: string; logo: string; score: number | null };
  away: { id: string; short: string; logo: string; score: number | null };
};

interface Props {
  onOpenChat: () => void;
}

type Summary = {
  partner: { id: string; name: string; username?: string; avatarUrl: string } | null;
  expectedPartnerName: string;
  lastMessage: { text?: string; type: string; time: string; senderId: string; createdAt?: string } | null;
  unread: number;
  streak: number;
  partnerOnline: boolean;
};

type StoryComment = { id: string; name: string; text: string; mine: boolean };
type StoryReaction = { emoji: string; name: string; mine: boolean };

const REACTIONS = ["❤️", "😍", "😂", "😮", "😢", "🔥"];

type Story = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  seen: boolean;
  liked?: boolean;
  likeCount?: number;
  comments?: StoryComment[];
  reactions?: StoryReaction[];
  myReaction?: string;
};

export default function ChatsTab({ onOpenChat }: Props) {
  const { user, partner, couple, refresh } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [watching, setWatching] = useState<Story | null>(null);
  const [comment, setComment] = useState("");
  const [adding, setAdding] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{ file: File; preview: string; video: boolean } | null>(null);
  const [caption, setCaption] = useState("");
  const [storyBroken, setStoryBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { daily, answer } = useDaily();
  const [showDaily, setShowDaily] = useState(false);
  const [nudgeNote, setNudgeNote] = useState("");
  const [nudging, setNudging] = useState(false);
  const [matchDay, setMatchDay] = useState<MatchDay | null>(null);
  const [showFootball, setShowFootball] = useState(false);
  const myTeamId = user?.favoriteTeam?.id;
  const theirTeamId = partner?.favoriteTeam?.id;

  // When either of your teams plays soon (or is playing now), show it on the home screen.
  useEffect(() => {
    if (!myTeamId && !theirTeamId) return;
    api<MatchDay[]>("/api/football/matches")
      .then((matches) => {
        const ours = (match: MatchDay) => [match.home.id, match.away.id].some((id) => id === myTeamId || id === theirTeamId);
        const soon = Date.now() + 36 * 60 * 60 * 1000;
        const next = matches.find((match) => ours(match) && (match.status === "live" || (match.status === "scheduled" && new Date(match.kickoff).getTime() < soon)));
        setMatchDay(next || null);
      })
      .catch(() => undefined);
  }, [myTeamId, theirTeamId]);

  const nudge = async () => {
    if (nudging) return;
    setNudging(true);
    navigator.vibrate?.(40);
    try {
      await sendNudge();
      setNudgeNote("Sent 💗 They'll feel it");
    } catch (error) {
      setNudgeNote(error instanceof Error ? error.message : "Could not send that");
    } finally {
      setNudging(false);
      window.setTimeout(() => setNudgeNote(""), 2400);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
    api<Summary>("/api/chat/summary").then(setSummary).catch(() => undefined);
    api<Story[]>("/api/stories").then(setStories).catch(() => undefined);
    const reloadStories = () => {
      if (document.visibilityState === "visible") {
        api<Story[]>("/api/stories").then(setStories).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", reloadStories);
    const socket = scopedSocket();
    const apply = (story: Story) => {
      setStories((prev) => prev.some((item) => item.id === story.id) ? prev.map((item) => item.id === story.id ? story : item) : [story, ...prev]);
      setWatching((current) => current && current.id === story.id ? story : current);
    };
    socket.on("story:updated", apply);
    socket.on("story:new", apply);
    return () => {
      document.removeEventListener("visibilitychange", reloadStories);
      socket.disconnect();
    };
  }, []);

  const mine = stories.filter((story) => String(story.authorId) === String(user?.id));
  const theirs = stories.filter((story) => String(story.authorId) !== String(user?.id));

  const closeDraft = () => {
    if (storyDraft) URL.revokeObjectURL(storyDraft.preview);
    setStoryDraft(null);
    setCaption("");
  };

  const addStory = async () => {
    if (!storyDraft || adding) return;
    const { file } = storyDraft;
    setAdding(true);
    try {
      const uploaded = await uploadFile(file);
      const story = await api<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaUrl: uploaded.url,
          mediaType: file.type.startsWith("video") ? "video" : "image",
          caption: caption.trim(),
        }),
      });
      setStories((prev) => [story, ...prev]);
      closeDraft();
    } catch {
      // Keep the draft so it can be shared again.
    } finally {
      setAdding(false);
    }
  };

  const openStory = (story: Story) => {
    setStoryBroken(false);
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

  const reactToStory = async (emoji: string) => {
    if (!watching) return;
    const story = await api<Story>(`/api/stories/${watching.id}/react`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
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
  const lastType = summary?.lastMessage?.type;
  const preview = !summary?.lastMessage ? "Say something sweet"
    : lastType === "sticker" ? `${summary.lastMessage.text || "🌟"} Sticker`
    : summary.lastMessage.text
      || (lastType === "image" ? "📷 Photo" : lastType === "video" ? "🎥 Video" : lastType === "voice" ? "🎤 Voice note" : "Message");
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
              if (file) setStoryDraft({ file, preview: URL.createObjectURL(file), video: file.type.startsWith("video") });
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
              <span className={`${styles.time} ${summary?.unread ? styles.timeUnread : ""}`}>{summary?.lastMessage ? (summary.lastMessage.createdAt ? listTime(summary.lastMessage.createdAt) : summary.lastMessage.time) : ""}</span>
            </div>
            <div className={styles.bottomRow}>
              <span className={styles.lastMsg}>{preview}</span>
              {!!summary?.unread && <span className={styles.badge}>{summary.unread}</span>}
            </div>
          </div>
        </button>
      </div>

      <div className={styles.extras}>
        <button type="button" className={`${styles.nudgeCard} ${nudging ? styles.nudgeSending : ""}`} onClick={() => void nudge()}>
          <span className={styles.nudgeHeart}>💗</span>
          <span className={styles.nudgeCopy}>
            <strong>Thinking of you</strong>
            <small>{nudgeNote || `Send ${partnerName} a little heart`}</small>
          </span>
        </button>

        {matchDay && (
          <button type="button" className={styles.matchCard} onClick={() => setShowFootball(true)}>
            <span className={styles.matchKicker}>
              {matchDay.status === "live" ? <><i className={styles.matchLiveDot} />Live now</> : `⚽ ${dayLabel(matchDay.kickoff)} · ${clockTime(matchDay.kickoff)}`}
            </span>
            <span className={styles.matchTeams}>
              <img src={matchDay.home.logo} alt="" width={28} height={28} />
              <strong>{matchDay.home.short}</strong>
              <em>{matchDay.status === "live" ? `${matchDay.home.score ?? 0} – ${matchDay.away.score ?? 0}` : "vs"}</em>
              <strong>{matchDay.away.short}</strong>
              <img src={matchDay.away.logo} alt="" width={28} height={28} />
            </span>
            <span className={styles.matchCta}>{matchDay.status === "live" ? "See your bet →" : "Place your bet →"}</span>
          </button>
        )}

        <button type="button" className={styles.dailyCard} onClick={() => setShowDaily(true)}>
          <span className={styles.dailyKicker}>
            💬 Question of the day
            {daily && daily.mine === null && <em className={styles.dailyDot}>New</em>}
          </span>
          <span className={styles.dailyQuestion}>{daily?.question || "Loading…"}</span>
          <span className={styles.dailyStatus}>
            {!daily ? "" : daily.mine === null
              ? (daily.theyAnswered ? `🔒 ${partnerName} answered. Your turn` : "Answer to keep your streak 🔥")
              : daily.theirs === null ? `Waiting for ${partnerName}…` : "You both answered. Tap to read 💞"}
          </span>
        </button>
      </div>

      <OnThisDay />

      {showDaily && (
        <DailyQuestion daily={daily} partnerName={partnerName} onAnswer={answer} onClose={() => setShowDaily(false)} />
      )}

      {showFootball && createPortal(
        <div className={styles.fullScreen}>
          <FootballScreen onBack={() => setShowFootball(false)} />
        </div>,
        document.body,
      )}

      {/* Story screens render on <body> so the app frame and bottom menu can never cover them. */}
      {(storyDraft || watching) && createPortal(<>
      {storyDraft && (
        <div className={styles.viewer}>
          <button type="button" className={styles.viewerClose} onClick={closeDraft} aria-label="Discard story">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {storyDraft.video
            ? <video src={storyDraft.preview} className={styles.viewerMedia} autoPlay loop muted playsInline />
            : <img src={storyDraft.preview} alt="" className={styles.viewerMedia} />}
          {caption.trim() && <p className={styles.storyCaption}>{caption}</p>}
          <div className={styles.viewerDock}>
            <form className={styles.viewerRow} onSubmit={(event) => { event.preventDefault(); void addStory(); }}>
              <input
                className={styles.viewerInput}
                placeholder="Add a caption…"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={200}
                autoFocus
              />
              <button type="submit" className={styles.storyShare} disabled={adding}>
                {adding ? <span className={styles.storySpinner} /> : "Share"}
              </button>
            </form>
          </div>
        </div>
      )}

      {watching && (
        <div className={styles.viewer}>
          <button type="button" className={styles.viewerClose} onClick={() => setWatching(null)} aria-label="Close story">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {storyBroken && <p className={styles.storyMissing}>This story did not load. Add it again if it stays blank.</p>}
          {watching.mediaType === "video"
            ? <video src={mediaUrl(watching.mediaUrl)} className={styles.viewerMedia} autoPlay playsInline onError={() => setStoryBroken(true)} />
            : <img src={mediaUrl(watching.mediaUrl)} alt="" className={styles.viewerMedia} onError={() => setStoryBroken(true)} />}
          {watching.caption && <p className={styles.storyCaption}>{watching.caption}</p>}
          <div className={styles.viewerDock}>
            {String(watching.authorId) === String(user?.id) ? (
              !!watching.reactions?.length && (
                <div className={styles.viewerReactedBy}>
                  {watching.reactions.map((item, idx) => (
                    <span key={idx}>{item.emoji} {item.name}</span>
                  ))}
                </div>
              )
            ) : (
              <div className={styles.viewerReactions}>
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`${styles.viewerReaction} ${watching.myReaction === emoji ? styles.viewerReactionOn : ""}`}
                    onClick={() => void reactToStory(emoji)}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
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
                placeholder={String(watching.authorId) === String(user?.id) ? "Add a comment" : "Reply to this story"}
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
      </>, document.body)}
    </div>
  );
}
