"use client";

import { Fragment, useState, useRef, useEffect, type ReactNode } from "react";
import { scopedSocket, type ScopedSocket } from "@/lib/socket";
import styles from "./ChatView.module.css";
import { api, mediaUrl, shownName, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import EmojiPicker from "./EmojiPicker";
import { useCoupleCall } from "@/hooks/useCoupleCall";
import { showHomeBadge } from "@/lib/badge";
import { noteAudio, playMessageNote, playSendTick } from "@/lib/note";
import StreakScreen from "./StreakScreen";
import SnapCamera from "./SnapCamera";
import DailyQuestion from "./DailyQuestion";
import { sendNudge } from "./HeartBurst";
import { useDaily } from "@/hooks/useDaily";
import { saveMedia } from "@/lib/saveMedia";
import ViewOnceIcon from "./ViewOnceIcon";
import { clockTime, dayLabel, sameDay } from "@/lib/chatDates";
import { readChatCache, writeChatCache } from "@/lib/chatCache";

interface Props {
  onBack: () => void;
}

type MessageType = "text" | "voice" | "image" | "video" | "system";

interface Message {
  id: string;
  senderId?: string;
  text?: string;
  mediaUrl?: string;
  from: "me" | "babe";
  time: string;
  type: MessageType;
  read?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  replyToId?: string | null;
  viewOnce?: boolean;
  viewedByPartner?: boolean;
  createdAt?: string;
  /** Shown straight away while the server saves it. */
  pending?: boolean;
  failed?: boolean;
}

type ServerMessage = Omit<Message, "from"> & { senderId: string };

let tempCounter = 0;

// A local copy of a text message so it shows the moment you tap send.
function draftMessage(text: string, replyToId: string | undefined, senderId: string | undefined, id?: string): Message {
  tempCounter += 1;
  const now = new Date().toISOString();
  return {
    id: id || `tmp-${Date.now()}-${tempCounter}`,
    senderId,
    text,
    type: "text",
    from: "me",
    time: clockTime(now),
    createdAt: now,
    replyToId: replyToId || null,
    pending: true,
  };
}

type ChatPin = { id: string; preview: string; until: string };

type MenuAnchor = { top: number; bottom: number; left: number; right: number };

const MENU_WIDTH = 216;
const MENU_ROW = 46;

const MenuIcon = {
  reply: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5" /><path d="M9 10.76V4h6v6.76a2 2 0 0 0 .55 1.38L18 15H6l2.45-2.86A2 2 0 0 0 9 10.76z" /><line x1="8" y1="4" x2="16" y2="4" /></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>,
  select: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9.5" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  save: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
};

function pinTimeLeft(until: string) {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "Ending";
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 48) return `${hours}h left`;
  return `${Math.ceil(hours / 24)} days left`;
}

function ChatPhoto({ src, onOpen, children }: { src: string; onOpen: (url: string) => void; children: ReactNode }) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    setCurrent(src);
    setFailed(false);
    tried.current = false;
  }, [src]);

  if (failed) return <div className={styles.mediaMissing}>Photo unavailable</div>;

  return (
    <button type="button" className={styles.mediaFrame} onClick={() => onOpen(current)}>
      <img
        src={current}
        alt=""
        loading="lazy"
        decoding="async"
        className={styles.mediaImg}
        onError={() => {
          if (tried.current) {
            setFailed(true);
            return;
          }
          tried.current = true;
          api<{ url: string }>("/api/uploads/link", { method: "POST", body: JSON.stringify({ url: current }) })
            .then((data) => setCurrent(mediaUrl(data.url)))
            .catch(() => setFailed(true));
        }}
      />
      {children}
    </button>
  );
}

export default function ChatView({ onBack }: Props) {
  const { user, partner, couple, refresh } = useSession();
  const partnerRef = useRef(partner);
  partnerRef.current = partner;
  const [messages, setMessages] = useState<Message[]>(() => readChatCache<Message>(user?.id).filter((item) => !item.pending && !item.failed));
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [socket, setSocket] = useState<ScopedSocket | null>(null);
  const call = useCoupleCall(socket);
  const [swapVideos, setSwapVideos] = useState(false);
  const [callChrome, setCallChrome] = useState(true);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordLevels, setRecordLevels] = useState<number[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wallpaper state
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  // Message Actions state
  const [contextMenu, setContextMenu] = useState<{ msgId: string, anchor: MenuAnchor | null, isMe: boolean, width: number, height: number } | null>(null);
  const [pinChoices, setPinChoices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [showStreak, setShowStreak] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number; at: number; active: boolean; locked: boolean } | null>(null);
  const { daily, answer: answerDaily } = useDaily();
  const [showDaily, setShowDaily] = useState(false);
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [replyingToMsg, setReplyingToMsg] = useState<Message | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [streak, setStreak] = useState(couple?.currentStreak || 0);
  const [streakState, setStreakState] = useState<"start" | "saved" | "waiting" | "expiring" | "lost">("start");
  const [streakHours, setStreakHours] = useState(0);
  const [draftMedia, setDraftMedia] = useState<{ file: File; kind: "image" | "video"; preview: string } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; kind: "image" | "video"; once?: boolean } | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [partnerAvatarViewer, setPartnerAvatarViewer] = useState(false);
  const chatTitle = shownName(partner)
    || (couple?.expectedPartnerName && couple.expectedPartnerName !== user?.name ? couple.expectedPartnerName : "")
    || "My Babe";
  const [streakNote, setStreakNote] = useState("");
  const [micAsk, setMicAsk] = useState<null | "note" | "call" | "video" | "answer">(null);
  const [pin, setPin] = useState<ChatPin | null>(null);

  useEffect(() => {
    if (!streakNote) return;
    const timer = window.setTimeout(() => setStreakNote(""), 2600);
    return () => window.clearTimeout(timer);
  }, [streakNote]);

  // Audio Recording Ref
  const recRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
    started: number;
  } | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const wallpaperTried = useRef(false);

  // ScopedSocket state
  const socketRef = useRef<ScopedSocket | null>(null);
  const hasMoreRef = useRef(false);
  const loadingOlder = useRef(false);
  const messagesStateRef = useRef(messages);
  messagesStateRef.current = messages;

  const asView = (data: ServerMessage): Message => ({
    ...data,
    id: String(data.id),
    mediaUrl: data.mediaUrl ? mediaUrl(data.mediaUrl) : undefined,
    replyToId: data.replyToId ? String(data.replyToId) : null,
    time: data.createdAt ? clockTime(data.createdAt) : data.time,
    from: String(data.senderId) === String(user?.id) ? "me" : "babe",
  });

  useEffect(() => {
    if (!user) return;
    api<{ messages: ServerMessage[]; hasMore: boolean }>("/api/chat/messages")
      .then((page) => {
        hasMoreRef.current = page.hasMore;
        // Keep anything still sending; it isn't on the server yet.
        setMessages((prev) => [...page.messages.map(asView), ...prev.filter((item) => item.pending || item.failed)]);
      })
      .catch(() => undefined);
    api("/api/chat/read", { method: "POST" }).catch(() => undefined);
    api<{ message: ServerMessage | null; preview?: string; until?: string }>("/api/chat/pin")
      .then((data) => {
        if (!data.message || !data.until) return setPin(null);
        setPin({ id: String(data.message.id), preview: data.preview || data.message.text || "Message", until: data.until });
      })
      .catch(() => undefined);

    const socket = scopedSocket();
    socketRef.current = socket;
    setSocket(socket);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("message:new", (data: ServerMessage) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === String(data.id))) return prev;
        // Our own message coming back: swap it in for the copy shown while sending.
        if (String(data.senderId) === String(user.id)) {
          const index = prev.findIndex((item) => item.pending && item.type === data.type && item.text === data.text);
          if (index >= 0) {
            const next = [...prev];
            next[index] = asView(data);
            return next;
          }
        }
        return [...prev, asView(data)];
      });
      setIsTyping(false);
      if (String(data.senderId) !== String(user.id)) {
        playMessageNote();
        if (document.visibilityState === "visible") {
          api("/api/chat/read", { method: "POST" }).catch(() => undefined);
        } else {
          void showHomeBadge();
          if ("Notification" in window && Notification.permission === "granted") {
            const person = partnerRef.current;
            const title = shownName(person, "Little Temptation");
            const body = data.type === "text" ? (data.text || "New message") : data.type === "image" ? "Sent a photo" : data.type === "video" ? "Sent a video" : "Sent a voice note";
            const icon = person?.avatarUrl ? mediaUrl(person.avatarUrl) : "/app-icon-192.png";
            new Notification(title, { body: String(body).slice(0, 140), icon, silent: true });
          }
        }
      }
    });
    socket.on("message:updated", (data: ServerMessage) => {
      setMessages((prev) => prev.map((item) => item.id === String(data.id) ? asView(data) : item));
      if (data.isDeleted) setPin((current) => current?.id === String(data.id) ? null : current);
    });
    socket.on("pin:updated", (data: { message?: ServerMessage | null; preview?: string; until?: string } | null) => {
      if (!data?.message || !data.until) return setPin(null);
      setPin({ id: String(data.message.id), preview: data.preview || data.message.text || "Message", until: data.until });
    });
    socket.on("messages:read", () => {
      setMessages((prev) => prev.map((item) => item.from === "me" ? { ...item, read: true } : item));
    });
    socket.on("typing", (payload: { userId: string; isTyping: boolean }) => {
      if (String(payload.userId) !== String(user.id)) setIsTyping(payload.isTyping);
    });
    socket.on("presence", (payload: { userId: string; online: boolean }) => {
      if (String(payload.userId) !== String(user.id)) setPartnerOnline(payload.online);
    });
    // The connection is shared and may already be up, so ask who's online now.
    socket.emit("presence:check");
    socket.on("connect", () => socket.emit("presence:check"));
    socket.on("partner:updated", () => {
      refresh().catch(() => undefined);
    });
    socket.on("couple:updated", () => {
      refresh().catch(() => undefined);
    });
    socket.on("streak:updated", () => {
      api<{ streak: number; state: "start" | "saved" | "waiting" | "expiring" | "lost"; hoursLeft: number }>("/api/chat/streak")
        .then((view) => {
          setStreak(view.streak);
          setStreakState(view.state);
          setStreakHours(view.hoursLeft);
        })
        .catch(() => undefined);
    });

    const markSeen = () => {
      if (document.visibilityState === "visible") {
        api("/api/chat/read", { method: "POST" }).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", markSeen);

    return () => {
      document.removeEventListener("visibilitychange", markSeen);
      setSocket(null);
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    writeChatCache(user?.id, messages.filter((item) => !item.pending && !item.failed));
  }, [messages, user?.id]);

  useEffect(() => {
    if (!call.notice) return;
    if (/microphone|camera/i.test(call.notice)) {
      setMicAsk(call.notice.includes("answer") ? "answer" : call.notice.includes("video") ? "video" : "call");
    }
  }, [call.notice]);

  const allowRecording = () => {
    const kind = micAsk;
    setMicAsk(null);
    if (kind === "note") void startRecording();
    else if (kind === "answer") void call.accept();
    else if (kind === "video") void call.start("video");
    else void call.start("voice");
  };

  useEffect(() => {
    wallpaperTried.current = false;
    setWallpaper(couple?.wallpaperUrl ? mediaUrl(couple.wallpaperUrl) : null);
  }, [couple?.wallpaperUrl]);

  const repairWallpaper = () => {
    if (wallpaperTried.current || !couple?.wallpaperUrl) {
      setWallpaper(null);
      return;
    }
    wallpaperTried.current = true;
    api<{ url: string }>("/api/uploads/link", { method: "POST", body: JSON.stringify({ url: couple.wallpaperUrl }) })
      .then((data) => setWallpaper(mediaUrl(data.url)))
      .catch(() => setWallpaper(null));
  };

  useEffect(() => {
    api<{ streak: number; state: "start" | "saved" | "waiting" | "expiring" | "lost"; hoursLeft: number }>("/api/chat/streak")
      .then((view) => {
        setStreak(view.streak);
        setStreakState(view.state);
        setStreakHours(view.hoursLeft);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unlock = () => { noteAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const list = messagesRef.current;
    if (!list || !stickToBottom.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, isTyping]);

  const addEmoji = (emoji: string) => {
    const field = messageInputRef.current;
    const start = field?.selectionStart ?? input.length;
    const end = field?.selectionEnd ?? input.length;
    const next = input.slice(0, start) + emoji + input.slice(end);
    setInput(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

  const growComposer = (field: HTMLTextAreaElement) => {
    field.style.height = "0px";
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
  };

  const send = () => {
    if (!input.trim()) return;

    if (editingMsgId) {
      const text = input.trim();
      const id = editingMsgId;
      setEditingMsgId(null);
      setInput("");
      if (messageInputRef.current) messageInputRef.current.style.height = "";
      setMessages((prev) => prev.map((item) => item.id === id ? { ...item, text, isEdited: true } : item));
      api(`/api/chat/messages/${id}`, { method: "PATCH", body: JSON.stringify({ text }) }).catch(() => undefined);
      return;
    }

    const replyToId = replyingToMsg?.id;
    setInput("");
    if (messageInputRef.current) messageInputRef.current.style.height = "";
    setReplyingToMsg(null);
    socketRef.current?.emit("typing", false);
    sendText(input.trim(), replyToId);
  };

  const sendText = (text: string, replyToId?: string, retryId?: string) => {
    const draft = draftMessage(text, replyToId, user?.id, retryId);
    setMessages((prev) => retryId ? prev.map((item) => item.id === retryId ? draft : item) : [...prev, draft]);
    stickToBottom.current = true;
    playSendTick();
    const fail = () => setMessages((prev) => prev.map((item) => item.id === draft.id && item.pending ? { ...item, pending: false, failed: true } : item));
    const timer = window.setTimeout(fail, 20000);
    socketRef.current?.emit("message:send", { text, type: "text", replyToId }, (result: { message?: ServerMessage; error?: string }) => {
      window.clearTimeout(timer);
      if (!result?.message) {
        fail();
        return;
      }
      const saved = asView(result.message);
      setMessages((prev) => prev.some((item) => item.id === saved.id)
        ? prev.filter((item) => item.id !== draft.id)
        : prev.map((item) => item.id === draft.id ? saved : item));
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setShowAttach(false);
    setDraftMedia((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return { file, kind: type, preview: URL.createObjectURL(file) };
    });
  };

  const sendDraft = async () => {
    if (!draftMedia || sendingMedia) return;
    setSendingMedia(true);
    try {
      const uploaded = await uploadFile(draftMedia.file);
      socketRef.current?.emit("message:send", { type: draftMedia.kind, mediaUrl: uploaded.url, viewOnce: viewOnceMode });
      URL.revokeObjectURL(draftMedia.preview);
      setDraftMedia(null);
      setViewOnceMode(false);
    } catch {
      setStreakNote("Could not send that");
    } finally {
      setSendingMedia(false);
    }
  };

  const handleWallpaperChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      setWallpaper(mediaUrl(uploaded.url));
      await api("/api/me/couple", { method: "PATCH", body: JSON.stringify({ wallpaperUrl: uploaded.url }) });
    } catch {
      setWallpaper(URL.createObjectURL(file));
    }
  };

  const startRecording = async () => {
    if (recRef.current) return;
    const ctx = new AudioContext();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(samples));
        let sum = 0;
        for (let i = 0; i < samples.length; i += 8) sum += samples[i] * samples[i];
        const level = Math.min(1, Math.sqrt(sum / (samples.length / 8)) * 6);
        setRecordLevels((prev) => [...prev.slice(-47), level]);
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      const started = Date.now();
      recRef.current = { stream, ctx, processor, chunks, started };
      setIsRecording(true);
      setRecordingTime(0);
      setRecordLevels([]);
      recordingTimerRef.current = setInterval(() => {
        const rec = recRef.current;
        if (rec) setRecordingTime(Math.floor((Date.now() - rec.started) / 1000));
      }, 250);
    } catch {
      void ctx.close();
      setIsRecording(false);
      setMicAsk("note");
    }
  };

  const finishRecording = async (shouldSend: boolean) => {
    const rec = recRef.current;
    recRef.current = null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    if (!rec) return;
    rec.processor.disconnect();
    rec.stream.getTracks().forEach((track) => track.stop());
    const sampleRate = rec.ctx.sampleRate;
    const chunks = rec.chunks;
    const seconds = (Date.now() - rec.started) / 1000;
    await rec.ctx.close();
    if (!shouldSend) return;
    if (seconds < 0.4 || chunks.length === 0) {
      setStreakNote("Hold the note a little longer, then tap send");
      return;
    }
    const file = new File([encodeWav(chunks, sampleRate)], "voice.wav", { type: "audio/wav" });
    try {
      const uploaded = await uploadFile(file);
      socketRef.current?.emit("message:send", { type: "voice", mediaUrl: uploaded.url });
    } catch {
      setStreakNote("Could not send the voice note");
    }
  };

  const menuOpenedAt = useRef(0);

  const openMessageMenu = (msg: Message, target?: HTMLElement) => {
    if (selectedIds || msg.pending || msg.failed) return;
    menuOpenedAt.current = Date.now();
    const root = rootRef.current?.getBoundingClientRect();
    const rect = target?.getBoundingClientRect();
    const anchor = root && rect
      ? { top: rect.top - root.top, bottom: rect.bottom - root.top, left: rect.left - root.left, right: rect.right - root.left }
      : null;
    setPinChoices(false);
    setContextMenu({ msgId: msg.id, anchor, isMe: msg.from === "me", width: root?.width || 360, height: root?.height || 640 });
  };

  const tapMessage = (msg: Message, target: HTMLElement, at: number) => {
    if (selectedIds) {
      setSelectedIds((ids) => {
        if (!ids) return ids;
        const next = ids.includes(msg.id) ? ids.filter((id) => id !== msg.id) : [...ids, msg.id];
        return next.length ? next : null;
      });
      return;
    }
    if (lastTap.current.id === msg.id && at - lastTap.current.at < 320) {
      lastTap.current = { id: "", at: 0 };
      openMessageMenu(msg, target);
      return;
    }
    lastTap.current = { id: msg.id, at };
  };

  const saveToPhone = async (url: string, kind: "image" | "video") => {
    if (savingMedia) return;
    setContextMenu(null);
    setSavingMedia(true);
    try {
      const result = await saveMedia(url, kind);
      if (result === "downloaded") setStreakNote(kind === "video" ? "Video saved to your downloads" : "Photo saved to your downloads");
      if (result === "shared") setStreakNote("Saved 💾");
    } catch {
      setStreakNote("Could not save that. Try again.");
    } finally {
      setSavingMedia(false);
    }
  };

  const copyText = async (text: string) => {
    setContextMenu(null);
    try {
      await navigator.clipboard.writeText(text);
      setStreakNote("Copied");
    } catch {
      setStreakNote("Could not copy that");
    }
  };

  const startSelecting = (id: string) => {
    setContextMenu(null);
    setSelectedIds([id]);
  };

  const selectedMessages = messages.filter((item) => selectedIds?.includes(item.id));

  const copySelected = () => {
    const text = selectedMessages.filter((item) => item.type === "text" && item.text).map((item) => item.text).join("\n");
    setSelectedIds(null);
    if (text) void copyText(text);
    else setStreakNote("Only text can be copied");
  };

  const deleteSelected = () => {
    const mine = selectedMessages.filter((item) => item.from === "me" && !item.isDeleted);
    mine.forEach((item) => handleDeleteMessage(item.id));
    setSelectedIds(null);
    if (mine.length < selectedMessages.length) setStreakNote("Only your own messages were deleted");
  };

  const checkInStreak = async () => {
    try {
      const result = await api<{ streak: number; state: "start" | "saved" | "waiting" | "expiring" | "lost"; hoursLeft: number; partnerCheckedIn: boolean }>("/api/chat/streak", { method: "POST" });
      setStreak(result.streak);
      setStreakState(result.state);
      setStreakHours(result.hoursLeft);
      setStreakNote(result.partnerCheckedIn ? "Streak kept for today" : "Saved. They still need to check in");
    } catch {
      setStreakNote("Could not save the streak");
    }
  };

  const bestStreak = Math.max(couple?.bestStreak || 0, couple?.currentStreak || 0, streak);

  const nudgePartner = async () => {
    navigator.vibrate?.(40);
    try {
      await sendNudge();
      setStreakNote(`💗 ${chatTitle} will feel that`);
    } catch (error) {
      setStreakNote(error instanceof Error ? error.message : "Could not send that");
    }
  };


  const handleDeleteMessage = (id: string) => {
    setContextMenu(null);
    setMessages((prev) => prev.map((item) => item.id === id ? { ...item, isDeleted: true, text: undefined, mediaUrl: undefined } : item));
    api(`/api/chat/messages/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  const handleEditMessage = (msg: Message) => {
    setInput(msg.text || "");
    setEditingMsgId(msg.id);
    setReplyingToMsg(null);
    setContextMenu(null);
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyingToMsg(msg);
    setEditingMsgId(null);
    setContextMenu(null);
  };

  const handlePinMessage = (id: string, hours: 24 | 168 | 720) => {
    setContextMenu(null);
    api<{ message: ServerMessage; preview: string; until: string }>(`/api/chat/messages/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ hours }),
    })
      .then((data) => setPin({ id: String(data.message.id), preview: data.preview, until: data.until }))
      .catch((error) => setStreakNote(error instanceof Error ? error.message : "Could not pin that message"));
  };

  const handleUnpin = () => {
    setContextMenu(null);
    setPin(null);
    api("/api/chat/pin", { method: "DELETE" }).catch(() => undefined);
  };

  useEffect(() => {
    if (!pin) return;
    const wait = new Date(pin.until).getTime() - Date.now();
    if (wait <= 0) {
      setPin(null);
      return;
    }
    const timer = window.setTimeout(() => setPin(null), wait);
    return () => window.clearTimeout(timer);
  }, [pin]);

  // Show "Today", "Yesterday", a weekday or a date above the first message of each day.
  const dayStarts = new Map<string, string>();
  let lastDay: string | undefined;
  messages.forEach((msg) => {
    if (!msg.createdAt) return;
    if (!lastDay || !sameDay(lastDay, msg.createdAt)) dayStarts.set(msg.id, dayLabel(msg.createdAt));
    lastDay = msg.createdAt;
  });

  // Swipe left or right anywhere in the chat to go back to the chat list.
  const swipeBlocked = Boolean(
    contextMenu || selectedIds || viewer || showCamera || showStreak || showDaily || draftMedia
    || call.phase !== "idle" || isRecording || partnerAvatarViewer || micAsk || showEmoji,
  );

  const onSwipeStart = (event: React.TouchEvent) => {
    if (swipeBlocked) return;
    if ((event.target as HTMLElement).closest("textarea, input, [data-no-swipe]")) return;
    const point = event.touches[0];
    swipeRef.current = { x: point.clientX, y: point.clientY, at: event.timeStamp, active: false, locked: false };
  };

  const onSwipeMove = (event: React.TouchEvent) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.locked) return;
    const point = event.touches[0];
    const dx = point.clientX - swipe.x;
    const dy = point.clientY - swipe.y;
    if (!swipe.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        swipe.locked = true;
        return;
      }
      if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      swipe.active = true;
    }
    const el = rootRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 700));
  };

  const onSwipeEnd = (event: React.TouchEvent) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (!swipe?.active) return;
    const dx = event.changedTouches[0].clientX - swipe.x;
    const speed = Math.abs(dx) / Math.max(1, event.timeStamp - swipe.at);
    const el = rootRef.current;
    if (Math.abs(dx) > 110 || (Math.abs(dx) > 50 && speed > 0.6)) {
      if (el) {
        el.style.transition = "transform 0.2s ease, opacity 0.2s ease";
        el.style.transform = `translateX(${dx < 0 ? "-100%" : "100%"})`;
        el.style.opacity = "0";
      }
      window.setTimeout(onBack, 170);
      return;
    }
    if (el) {
      el.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease";
      el.style.transform = "";
      el.style.opacity = "";
    }
  };

  return (
    <div
      ref={rootRef}
      className={styles.chatView}
      onTouchStart={onSwipeStart}
      onTouchMove={onSwipeMove}
      onTouchEnd={onSwipeEnd}
      onTouchCancel={onSwipeEnd}
    >
      
      {/* ── Call Overlay ── */}
      {call.phase !== "idle" && (() => {
        const isVideo = call.callType === "video";
        const connected = call.phase === "connected";
        const localBig = isVideo && (!connected || swapVideos);
        const clock = `${String(Math.floor(call.seconds / 60)).padStart(2, "0")}:${String(call.seconds % 60).padStart(2, "0")}`;
        const status = call.phase === "incoming"
          ? (isVideo ? "Incoming video call" : "Incoming voice call")
          : call.phase === "calling" ? "Ringing…" : clock;
        const avatar = partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}&background=FF4081&color=fff&size=200`;
        const micIcon = call.muted ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
        );
        const speakerIcon = call.speakerOn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
        );
        const hangIcon = (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1A15.9 15.9 0 0 0 12 9z" /></svg>
        );
        return (
          <div
            className={`${styles.callOverlay} ${isVideo ? styles.callOverlayVideo : ""} ${isVideo && connected && !callChrome ? styles.callChromeHidden : ""}`}
            onClick={() => { if (isVideo && connected) setCallChrome((value) => !value); }}
          >
            <audio ref={call.remoteAudioRef} autoPlay playsInline />
            {isVideo && (
              <>
                <video
                  ref={call.remoteVideoRef}
                  className={localBig ? styles.pipVideo : styles.stageVideo}
                  autoPlay
                  playsInline
                  onClick={(event) => { if (localBig && connected) { event.stopPropagation(); setSwapVideos(false); } }}
                />
                <video
                  ref={call.localVideoRef}
                  className={`${localBig ? styles.stageVideo : styles.pipVideo} ${call.facing === "user" ? styles.mirrorVideo : ""} ${!call.cameraOn ? styles.videoOff : ""}`}
                  autoPlay
                  playsInline
                  muted
                  onClick={(event) => { if (!localBig && connected) { event.stopPropagation(); setSwapVideos(true); } }}
                />
                <div className={styles.callShade} />
              </>
            )}

            {isVideo && call.phase !== "incoming" ? (
              <div className={styles.videoTopBar}>
                <span className={styles.videoTopSpacer} />
                <div className={styles.videoTitle}>
                  <strong>{chatTitle}</strong>
                  <span>{call.phase === "calling" ? "Ringing…" : "Video call"}</span>
                </div>
                <button
                  type="button"
                  className={styles.videoTopBtn}
                  onClick={(event) => { event.stopPropagation(); void call.switchCamera(); }}
                  aria-label="Switch camera"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
                    <path d="M9 13.5a3 3 0 0 1 5.2-2" /><polyline points="14.5 9.5 14.5 11.6 12.4 11.6" />
                    <path d="M15 12.5a3 3 0 0 1-5.2 2" /><polyline points="9.5 16.5 9.5 14.4 11.6 14.4" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className={styles.callHeader}>
                <img src={avatar} alt="" className={styles.callAvatar} />
                <h2 className={styles.callName}>{chatTitle}</h2>
                <p className={styles.callStatus}>{status}</p>
              </div>
            )}

            {call.phase === "incoming" ? (
              <div className={styles.callControls}>
                <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={call.decline} aria-label="Decline">{hangIcon}</button>
                <button className={`${styles.controlBtn} ${styles.acceptCallBtn}`} onClick={call.accept} aria-label="Accept">
                  {isVideo ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  )}
                </button>
              </div>
            ) : (
              <div className={styles.callDock} onClick={(event) => event.stopPropagation()}>
                {isVideo && connected && <span className={styles.callTimer}>{clock}</span>}
                <div className={styles.callControls}>
                  {isVideo && (
                    <button
                      className={`${styles.controlBtn} ${call.cameraOn ? "" : styles.controlBtnActive}`}
                      onClick={call.toggleCamera}
                      aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        {!call.cameraOn && <line x1="1" y1="1" x2="23" y2="23" />}
                      </svg>
                    </button>
                  )}
                  <button className={`${styles.controlBtn} ${call.muted ? styles.controlBtnActive : ""}`} onClick={call.toggleMute} aria-label={call.muted ? "Unmute" : "Mute"}>
                    {micIcon}
                  </button>
                  <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={call.hangup} aria-label="End call">{hangIcon}</button>
                  <button className={`${styles.controlBtn} ${call.speakerOn ? "" : styles.controlBtnActive}`} onClick={call.toggleSpeaker} aria-label={call.speakerOn ? "Mute their sound" : "Unmute their sound"}>
                    {speakerIcon}
                  </button>
                </div>
                {isVideo && connected && <p className={styles.callHint}>Tap the screen to hide controls · tap the small video to swap</p>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Header */}
      <header className={styles.header}>
        <button id="btn-chat-back" className={styles.backBtn} onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          className={styles.avatarWrap}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onClick={() => setPartnerAvatarViewer(true)}
          aria-label="View partner photo"
          title="Tap to view photo"
        >
          <img
            src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}&background=F97316&color=fff&size=80`}
            alt="Partner"
            className={styles.avatarImg}
          />
          <span className={styles.onlineBadge} style={{ background: partnerOnline ? '#22c55e' : '#ef4444' }} />
        </button>

        <div className={styles.chatInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <p className={styles.chatName}>{chatTitle}</p>
            <button
              className={`${styles.streakBtn} ${streakState === "expiring" ? styles.streakHot : ""} ${streakState === "lost" ? styles.streakCold : ""}`}
              onClick={() => setShowStreak(true)}
              aria-label="Open our streak"
            >
              {streakState === "expiring" ? "⏳" : "🔥"} {streak}
            </button>
          </div>
          <p className={styles.chatStatus} style={{ color: partnerOnline ? '#22c55e' : '#ef4444' }}>
            {!connected ? "Connecting…" : partnerOnline ? "Online" : couple?.status === "pending" ? "Waiting to join" : "Offline"}
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => wallpaperInputRef.current?.click()} title="Change Wallpaper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button id="btn-call" className={styles.iconBtn} onClick={() => { setSwapVideos(false); setCallChrome(true); void call.start("voice"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button id="btn-video" className={styles.iconBtn} onClick={() => { setSwapVideos(false); setCallChrome(true); void call.start("video"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </header>

      {micAsk && (
        <div className={styles.micScrim}>
          <div className={styles.micCard}>
            <h2>Allow recording</h2>
            <p>Voice notes and calls need the microphone. Tap allow, then accept it on your phone.</p>
            <button type="button" className={styles.micAllow} onClick={allowRecording}>Allow recording</button>
            <button type="button" className={styles.micLater} onClick={() => setMicAsk(null)}>Not now</button>
          </div>
        </div>
      )}

      {pin && (
        <div className={styles.pinBar}>
          <button
            type="button"
            className={styles.pinJump}
            onClick={() => document.getElementById(`msg-${pin.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <span className={styles.pinMark} />
            <span className={styles.pinCopy}>
              <span className={styles.pinLabel}>Pinned · {pinTimeLeft(pin.until)}</span>
              <span className={styles.pinText}>{pin.preview}</span>
            </span>
          </button>
          <button type="button" className={styles.pinClose} onClick={handleUnpin} aria-label="Unpin">×</button>
        </div>
      )}

      {/* Message menu: opens on double tap, long press or right click */}
      {contextMenu && (() => {
        const target = messages.find((item) => item.id === contextMenu.msgId);
        if (!target) return null;
        const live = !target.isDeleted;
        const items: { key: string; label: string; icon: ReactNode; danger?: boolean; run: () => void }[] = pinChoices
          ? [
            { key: "back", label: "Back", icon: MenuIcon.back, run: () => setPinChoices(false) },
            { key: "p24", label: "Pin for 24 hours", icon: MenuIcon.pin, run: () => handlePinMessage(target.id, 24) },
            { key: "p168", label: "Pin for 7 days", icon: MenuIcon.pin, run: () => handlePinMessage(target.id, 168) },
            { key: "p720", label: "Pin for 30 days", icon: MenuIcon.pin, run: () => handlePinMessage(target.id, 720) },
          ]
          : [
            { key: "reply", label: "Reply", icon: MenuIcon.reply, run: () => handleReplyMessage(target) },
            ...(live && target.type === "text" && target.text ? [{ key: "copy", label: "Copy Text", icon: MenuIcon.copy, run: () => void copyText(target.text || "") }] : []),
            ...(pin?.id === target.id
              ? [{ key: "unpin", label: "Unpin", icon: MenuIcon.pin, run: handleUnpin }]
              : live ? [{ key: "pin", label: "Pin", icon: MenuIcon.pin, run: () => setPinChoices(true) }] : []),
            ...(contextMenu.isMe && live && target.type === "text" ? [{ key: "edit", label: "Edit", icon: MenuIcon.edit, run: () => handleEditMessage(target) }] : []),
            ...(live && !target.viewOnce && target.mediaUrl && (target.type === "image" || target.type === "video")
              ? [{ key: "save", label: "Save to phone", icon: MenuIcon.save, run: () => void saveToPhone(target.mediaUrl || "", target.type === "video" ? "video" : "image") }]
              : []),
            { key: "select", label: "Select", icon: MenuIcon.select, run: () => startSelecting(target.id) },
            ...(contextMenu.isMe && live ? [{ key: "delete", label: "Delete", icon: MenuIcon.trash, danger: true, run: () => handleDeleteMessage(target.id) }] : []),
          ];
        const { width, height } = contextMenu;
        const menuHeight = items.length * MENU_ROW + 12;
        const anchor = contextMenu.anchor;
        let top = anchor ? anchor.bottom + 6 : (height - menuHeight) / 2;
        if (anchor && top + menuHeight > height - 12) top = anchor.top - menuHeight - 6;
        top = Math.max(12, Math.min(top, height - menuHeight - 12));
        let left = anchor ? (contextMenu.isMe ? anchor.right - MENU_WIDTH : anchor.left) : (width - MENU_WIDTH) / 2;
        left = Math.max(10, Math.min(left, width - MENU_WIDTH - 10));
        return (
          <div
            className={styles.menuScrim}
            onClick={() => {
              if (Date.now() - menuOpenedAt.current < 450) return;
              setContextMenu(null);
            }}
          >
            <div
              className={styles.menuPopover}
              style={{ top, left, width: MENU_WIDTH, transformOrigin: anchor && top < anchor.top ? "bottom center" : "top center" }}
              onClick={(event) => event.stopPropagation()}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`${styles.menuItem} ${item.danger ? styles.menuDanger : ""}`}
                  onClick={item.run}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {selectedIds && (
        <div className={styles.selectBar}>
          <button type="button" className={styles.selectCancel} onClick={() => setSelectedIds(null)} aria-label="Cancel selection">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <span className={styles.selectCount}>{selectedIds.length} selected</span>
          <button type="button" className={styles.selectAction} onClick={copySelected} aria-label="Copy selected">{MenuIcon.copy}</button>
          <button type="button" className={`${styles.selectAction} ${styles.menuDanger}`} onClick={deleteSelected} aria-label="Delete selected">{MenuIcon.trash}</button>
        </div>
      )}

      {showStreak && (
        <StreakScreen
          streak={streak}
          state={streakState}
          hoursLeft={streakHours}
          bestStreak={bestStreak}
          partnerName={chatTitle}
          onClose={() => setShowStreak(false)}
          onSnap={() => { setShowStreak(false); setShowCamera(true); }}
          onCheckIn={() => void checkInStreak()}
        />
      )}

      {showCamera && (
        <SnapCamera
          onClose={() => setShowCamera(false)}
          onSent={() => setStreakNote("Snap sent 🔥 and saved to Memories")}
          bestStreak={bestStreak}
          partnerName={chatTitle}
        />
      )}

      {daily && daily.mine === null && !selectedIds && (
        <button type="button" className={styles.dailyBanner} onClick={() => setShowDaily(true)}>
          <span className={styles.dailyBannerIcon}>💬</span>
          <span className={styles.dailyBannerCopy}>
            <strong>{daily.theyAnswered ? `${chatTitle} answered today's question` : "Question of the day"}</strong>
            <span>{daily.question}</span>
          </span>
          <span className={styles.dailyBannerGo}>Answer</span>
        </button>
      )}

      {showDaily && (
        <DailyQuestion daily={daily} partnerName={chatTitle} onAnswer={answerDaily} onClose={() => setShowDaily(false)} />
      )}

      {/* Messages */}
      <div className={styles.chatBody}>
      {wallpaper && <img src={wallpaper} alt="" className={styles.wallpaper} onError={repairWallpaper} />}
      <div 
        ref={messagesRef}
        className={styles.messages}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
          if (list.scrollTop > 48 || !hasMoreRef.current || loadingOlder.current) return;
          const oldest = messagesStateRef.current[0]?.createdAt;
          if (!oldest) return;
          loadingOlder.current = true;
          stickToBottom.current = false;
          const previousHeight = list.scrollHeight;
          api<{ messages: ServerMessage[]; hasMore: boolean }>(`/api/chat/messages?before=${encodeURIComponent(oldest)}`)
            .then((page) => {
              hasMoreRef.current = page.hasMore;
              setMessages((prev) => [...page.messages.map(asView), ...prev]);
              requestAnimationFrame(() => {
                list.scrollTop = list.scrollHeight - previousHeight;
              });
            })
            .finally(() => { loadingOlder.current = false; });
        }}
      >
        {streakState === "expiring" && (
          <div className={styles.streakBanner}>
            <span>🔥 {streak}</span>
            <p>Send a message in the next {streakHours}h or the streak ends.</p>
          </div>
        )}
        {streakState === "waiting" && (
          <div className={styles.streakBanner}>
            <span>🔥 {streak}</span>
            <p>You checked in. They still need to send a message today.</p>
          </div>
        )}
        {streakState === "lost" && (
          <div className={`${styles.streakBanner} ${styles.streakBannerCold}`}>
            <span>🔥</span>
            <p>The streak ended. Message each other today to start a new one.</p>
          </div>
        )}
        {messages.map((msg) => (
          <Fragment key={`day-${msg.id}`}>
          {dayStarts.has(msg.id) && <div className={styles.dateLabel}>{dayStarts.get(msg.id)}</div>}
          {((): ReactNode => {
          const repliedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

          // System message (mood change etc.)
          if (msg.type === "system") {
            return (
              <div key={msg.id} className={styles.systemRow}>
                <span className={styles.systemBubble}>{msg.text}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`${styles.row} ${msg.from === "me" ? styles.rowMe : styles.rowBabe} ${pin?.id === msg.id ? styles.rowPinned : ""} ${selectedIds?.includes(msg.id) ? styles.rowSelected : ""} ${contextMenu?.msgId === msg.id ? styles.rowFocused : ""}`}
              onClickCapture={(event) => {
                if (!selectedIds) return;
                event.preventDefault();
                event.stopPropagation();
                tapMessage(msg, event.currentTarget, event.timeStamp);
              }}
            >
              {selectedIds && <span className={styles.selectTick} aria-hidden="true" />}
              {msg.isDeleted ? (
                 <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`} style={{ opacity: 0.6, fontStyle: 'italic' }}>
                   <p className={styles.bubbleText}>This message was deleted</p>
                 </div>
              ) : (
                <div 
                  className={styles.msgHit}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === 'me' ? 'flex-end' : 'flex-start' }}
                  onClick={(event) => tapMessage(msg, event.currentTarget, event.timeStamp)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openMessageMenu(msg, event.currentTarget);
                  }}
                  onTouchStart={(event) => {
                    const el = event.currentTarget;
                    const timer = window.setTimeout(() => openMessageMenu(msg, el), 450);
                    el.dataset.timer = String(timer);
                  }}
                  onTouchEnd={(event) => window.clearTimeout(Number(event.currentTarget.dataset.timer))}
                  onTouchMove={(event) => window.clearTimeout(Number(event.currentTarget.dataset.timer))}
                >
                  {repliedMsg && (
                    <div className={styles.quote}>
                      <div className={styles.quoteName}>{repliedMsg.from === "me" ? "You" : chatTitle}</div>
                      <div className={styles.quoteText}>
                        {repliedMsg.isDeleted ? "Deleted message" : repliedMsg.type === "text" ? repliedMsg.text : repliedMsg.type === "voice" ? "Voice note" : repliedMsg.type === "image" ? "Photo" : "Video"}
                      </div>
                    </div>
                  )}

                  {msg.type === "image" && (
                    msg.viewOnce ? (
                      <OnceChip
                        msg={msg}
                        label="Photo"
                        onOpen={async () => {
                          await api(`/api/chat/messages/${msg.id}/view`, { method: "POST" }).catch(() => undefined);
                          setViewer({ url: msg.mediaUrl || "", kind: "image", once: true });
                        }}
                      />
                    ) : msg.mediaUrl ? (
                      <ChatPhoto src={msg.mediaUrl} onOpen={(url) => setViewer({ url, kind: "image" })}>
                        <span className={styles.mediaTime}>
                          {msg.time}
                          {msg.from === "me" && <DoubleCheck read={msg.read} light />}
                        </span>
                      </ChatPhoto>
                    ) : null
                  )}

                  {msg.type === "video" && (
                    msg.viewOnce ? (
                      <OnceChip
                        msg={msg}
                        label="Video"
                        onOpen={async () => {
                          await api(`/api/chat/messages/${msg.id}/view`, { method: "POST" }).catch(() => undefined);
                          setViewer({ url: msg.mediaUrl || "", kind: "video", once: true });
                        }}
                      />
                    ) : msg.mediaUrl ? (
                      <button type="button" className={styles.mediaFrame} onClick={() => setViewer({ url: msg.mediaUrl || "", kind: "video" })}>
                        <video src={msg.mediaUrl} className={styles.mediaImg} muted playsInline preload="metadata" />
                        <span className={styles.playBadge}>▶</span>
                        <span className={styles.mediaTime}>
                          {msg.time}
                          {msg.from === "me" && <DoubleCheck read={msg.read} light />}
                        </span>
                      </button>
                    ) : null
                  )}

                  {msg.type === "voice" && (
                    msg.viewOnce ? (
                      <OnceChip
                        msg={msg}
                        label="Voice note"
                        openedLabel="Played"
                        onOpen={async () => {
                          const audio = new Audio(msg.mediaUrl || "");
                          await audio.play().catch(() => undefined);
                          await api(`/api/chat/messages/${msg.id}/view`, { method: "POST" }).catch(() => undefined);
                        }}
                      />
                    ) : msg.mediaUrl ? (
                      <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`}>
                        <VoiceNote src={msg.mediaUrl} mine={msg.from === "me"} />
                        <span className={styles.bubbleTime}>
                          {msg.time}
                          {msg.from === "me" && <DoubleCheck read={msg.read} />}
                        </span>
                      </div>
                    ) : null
                  )}

                  {msg.type === "text" && msg.text && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`}>
                      <p className={styles.bubbleText}>{msg.text}</p>
                      <span className={styles.bubbleTime}>
                        {msg.isEdited && <span style={{ marginRight: '4px', opacity: 0.6 }}>Edited</span>}
                        {msg.time}
                        {msg.from === "me" && (msg.pending ? <PendingClock /> : msg.failed ? <span className={styles.failedMark}>!</span> : <DoubleCheck read={msg.read} />)}
                      </span>
                    </div>
                  )}
                  {msg.failed && (
                    <button
                      type="button"
                      className={styles.retryBtn}
                      onClick={(event) => { event.stopPropagation(); sendText(msg.text || "", msg.replyToId || undefined, msg.id); }}
                    >
                      Not sent · Tap to retry
                    </button>
                  )}
                </div>
              )}
            </div>
          );
          })()}
          </Fragment>
        ))}

        {isTyping && (
          <div className={`${styles.row} ${styles.rowBabe}`}>
            <div className={`${styles.bubble} ${styles.bubbleBabe} ${styles.typingBubble}`}>
              <div className={styles.typingDots}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      </div>

      {streakNote && <p className={styles.noteToast}>{streakNote}</p>}

      {draftMedia && (
        <div className={styles.previewSheet}>
          {draftMedia.kind === "video"
            ? <video src={draftMedia.preview} className={styles.previewMedia} controls playsInline />
            : <img src={draftMedia.preview} alt="" className={styles.previewMedia} />}
          <div className={styles.previewActions}>
            <button type="button" onClick={() => { URL.revokeObjectURL(draftMedia.preview); setDraftMedia(null); setViewOnceMode(false); }}>Cancel</button>
            <button
              type="button"
              className={viewOnceMode ? styles.viewOnceToggleOn : styles.viewOnceToggle}
              onClick={() => setViewOnceMode(v => !v)}
            >
              <ViewOnceIcon size={18} />
              {viewOnceMode ? "View once on" : "View once"}
            </button>
            <button type="button" className={styles.previewSend} onClick={sendDraft} disabled={sendingMedia}>
              {sendingMedia ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {viewer && (
        <div className={styles.lightbox} onClick={() => setViewer(null)}>
          {viewer.kind === "video"
            ? <video src={viewer.url} className={styles.lightboxMedia} controls autoPlay playsInline onClick={(event) => event.stopPropagation()} />
            : <img src={viewer.url} alt="" className={styles.lightboxMedia} onClick={(event) => event.stopPropagation()} />}
          <div className={styles.lightboxBar} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.lightboxBtn} onClick={() => setViewer(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            {viewer.once ? (
              <span className={styles.lightboxNote}><ViewOnceIcon size={16} /> View once · can&apos;t be saved</span>
            ) : (
              <button type="button" className={styles.lightboxSave} onClick={() => void saveToPhone(viewer.url, viewer.kind)} disabled={savingMedia}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></svg>
                {savingMedia ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Partner avatar full-screen viewer */}
      {partnerAvatarViewer && (
        <div className={styles.lightbox} onClick={() => setPartnerAvatarViewer(false)}>
          <img
            src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}&background=F97316&color=fff&size=400`}
            alt={chatTitle}
            className={styles.lightboxMedia}
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: '50%', maxWidth: 300, maxHeight: 300 }}
          />
        </div>
      )}

      {showEmoji && <EmojiPicker onPick={addEmoji} onClose={() => setShowEmoji(false)} />}

      {/* Attach panel */}
      {showAttach && (
        <div className={styles.attachPanel}>
          <button className={styles.attachOption} onClick={() => fileInputRef.current?.click()}>
            <div className={styles.attachIcon} style={{ background: "#FF4081" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span>Photo</span>
          </button>
          <button className={styles.attachOption} onClick={() => videoInputRef.current?.click()}>
            <div className={styles.attachIcon} style={{ background: "#F97316" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span>Video</span>
          </button>
          <button className={styles.attachOption} onClick={() => { setShowAttach(false); setShowCamera(true); }}>
            <div className={styles.attachIcon} style={{ background: "#1a1a1a" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <span>Snap</span>
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" ref={fileInputRef} onChange={e => handleFile(e, "image")} style={{ display: "none" }} />
      <input type="file" accept="video/*" ref={videoInputRef} onChange={e => handleFile(e, "video")} style={{ display: "none" }} />
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" ref={wallpaperInputRef} onChange={handleWallpaperChange} style={{ display: "none" }} />

      {/* Input bar wrapper */}
      <div className={styles.composer}>
        {(replyingToMsg || editingMsgId) && (
          <div className={styles.replyBar}>
            <div className={styles.replyCopy}>
              <span className={styles.replyTitle}>
                {editingMsgId ? "Editing Message" : `Replying to ${replyingToMsg?.from === "me" ? "yourself" : chatTitle}`}
              </span>
              <span className={styles.replyText}>
                {editingMsgId ? messages.find(m => m.id === editingMsgId)?.text : (replyingToMsg?.type === "text" ? replyingToMsg.text : `[${replyingToMsg?.type}]`)}
              </span>
            </div>
            <button
              className={styles.replyClose}
              onClick={() => { setReplyingToMsg(null); setEditingMsgId(null); setInput(""); }}
              aria-label="Cancel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        <div className={styles.inputBar} style={{ borderTop: 'none' }}>
          {isRecording ? (
            <div className={styles.recordingBar}>
              <button type="button" className={styles.recordCancel} onClick={() => finishRecording(false)} aria-label="Delete recording">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              </button>
              <div className={styles.recordPill}>
                <span className={styles.recordTime}>
                  <span className={styles.recordDot} />
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                </span>
                <span className={styles.recordWave} aria-hidden="true">
                  {Array.from({ length: 48 }, (_, i) => recordLevels[recordLevels.length - 48 + i] ?? 0).map((level, i) => (
                    <span key={i} style={{ height: `${Math.max(3, level * 26)}px` }} />
                  ))}
                </span>
              </div>
              <button type="button" className={styles.recordSend} onClick={() => finishRecording(true)} aria-label="Send voice note">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>
              </button>
            </div>
          ) : (
            <>
              <button
                id="btn-attach"
                className={styles.inputIconLeft}
                onClick={() => { setShowAttach(v => !v); setShowEmoji(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </button>

              <div className={styles.inputPill}>
                <textarea
                  id="input-message"
                  ref={messageInputRef}
                  className={styles.msgInput}
                  placeholder="Message..."
                  rows={1}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    growComposer(e.target);
                    socketRef.current?.emit("typing", e.target.value.length > 0);
                  }}
                />
                {!input.trim() && !editingMsgId && (
                  <button
                    type="button"
                    className={`${styles.emojiToggle} ${styles.heartToggle}`}
                    aria-label={`Tell ${chatTitle} you're thinking of them`}
                    onClick={() => void nudgePartner()}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.2l-1.4-1.3C5.4 15.2 2 12.1 2 8.3 2 5.2 4.4 2.8 7.5 2.8c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.6 11.6L12 21.2z" />
                    </svg>
                  </button>
                )}
                {!input.trim() && !editingMsgId && (
                  <button
                    type="button"
                    className={styles.emojiToggle}
                    aria-label="Open snap camera"
                    onClick={() => { setShowCamera(true); setShowAttach(false); setShowEmoji(false); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                )}
                <button
                  className={`${styles.emojiToggle} ${showEmoji ? styles.emojiToggleOn : ""}`}
                  aria-label={showEmoji ? "Close emojis" : "Emojis"}
                  onClick={() => { setShowEmoji((open) => !open); setShowAttach(false); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
              </div>
            </>
          )}

          {!isRecording && !(input.trim() || editingMsgId) && (
          <button
            id="btn-voice"
            type="button"
            className={styles.voiceBtn}
            onClick={startRecording}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          )}

          {!isRecording && (input.trim() || editingMsgId) && (
            <button id="btn-send" className={styles.sendBtn} onClick={send}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {editingMsgId ? (
                  <>
                    <polyline points="20 6 9 17 4 12" />
                  </>
                ) : (
                  <>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </>
                )}
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  chunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  });
  return new Blob([buffer], { type: "audio/wav" });
}

const PEAK_COUNT = 34;
const peakCache = new Map<string, number[]>();
const FALLBACK_PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
const SPEEDS = [1, 1.5, 2];

// Real waveform of the recording, worked out once per file and remembered.
async function loadPeaks(src: string) {
  const cached = peakCache.get(src);
  if (cached) return cached;
  const context = noteAudio();
  if (!context) return FALLBACK_PEAKS;
  const data = await (await fetch(src)).arrayBuffer();
  const audio = await context.decodeAudioData(data);
  const samples = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(samples.length / PEAK_COUNT));
  const peaks: number[] = [];
  for (let i = 0; i < PEAK_COUNT; i += 1) {
    let sum = 0;
    for (let j = 0; j < block; j += 16) sum += Math.abs(samples[i * block + j] || 0);
    peaks.push(sum / (block / 16));
  }
  const max = Math.max(...peaks, 0.0001);
  const scaled = peaks.map((peak) => Math.max(0.12, peak / max));
  peakCache.set(src, scaled);
  return scaled;
}

function VoiceNote({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [peaks, setPeaks] = useState<number[]>(() => peakCache.get(src) || FALLBACK_PEAKS);

  // Only fetch the real waveform once you press play, so opening the chat
  // doesn't download every voice note in it.
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!peakCache.has(src)) loadPeaks(src).then(setPeaks).catch(() => undefined);
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  const seek = (clientX: number) => {
    const audio = audioRef.current;
    const wave = waveRef.current;
    if (!audio || !wave || !audio.duration) return;
    const rect = wave.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const clock = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
  const shown = playing || progress > 0 ? duration * progress : duration;

  return (
    // Taps here control playback; they shouldn't count toward double-tap-for-menu.
    <div className={`${styles.voiceMsg} ${mine ? styles.voiceMine : ""}`} onClick={(event) => event.stopPropagation()} data-no-swipe>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
          event.currentTarget.playbackRate = speed;
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration) {
            setDuration(audio.duration);
            setProgress(audio.currentTime / audio.duration);
          }
        }}
      />
      <button type="button" className={styles.playBtn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>
      <div className={styles.voiceBody}>
        <div
          ref={waveRef}
          className={styles.waveform}
          onClick={(event) => seek(event.clientX)}
          onTouchMove={(event) => seek(event.touches[0].clientX)}
          role="slider"
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          {peaks.map((peak, index) => (
            <span
              key={index}
              className={`${styles.bar} ${(index + 0.5) / peaks.length <= progress ? styles.barPlayed : ""}`}
              style={{ height: `${Math.round(4 + peak * 20)}px` }}
            />
          ))}
          <span className={styles.waveKnob} style={{ left: `${progress * 100}%` }} />
        </div>
        <div className={styles.voiceMeta}>
          <span className={styles.voiceDur}>{clock(shown)}</span>
          {(playing || speed !== 1) && (
            <button type="button" className={styles.speedBtn} onClick={cycleSpeed} aria-label="Playback speed">
              {speed}×
            </button>
          )}
        </div>
      </div>
      <span className={styles.voiceMic} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z" /></svg>
      </span>
    </div>
  );
}

function OnceChip({ msg, label, openedLabel = "Opened", onOpen }: { msg: Message; label: string; openedLabel?: string; onOpen: () => void }) {
  const mine = msg.from === "me";
  const opened = Boolean(msg.viewedByPartner);
  const canOpen = !mine && !opened;
  const status = mine ? (opened ? openedLabel : "View once") : opened ? openedLabel : "Tap to open · once";
  return (
    <button
      type="button"
      className={`${styles.onceChip} ${mine ? styles.onceChipMe : styles.onceChipBabe} ${opened ? styles.onceChipOpened : ""}`}
      onClick={canOpen ? onOpen : undefined}
      disabled={!canOpen}
    >
      <span className={styles.onceChipIcon}><ViewOnceIcon size={26} opened={opened} /></span>
      <span className={styles.onceChipText}>
        <strong>{label}</strong>
        <small>{status}</small>
      </span>
      <span className={styles.onceChipTime}>
        {msg.time}
        {mine && <DoubleCheck read={msg.read} />}
      </span>
    </button>
  );
}

function PendingClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.55 }} aria-label="Sending">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DoubleCheck({ read, light }: { read?: boolean; light?: boolean }) {
  const on = light ? "#fff" : "currentColor";
  const off = light ? "rgba(255,255,255,0.75)" : "currentColor";
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0, opacity: read || light ? 1 : 0.45 }}>
      <path d="M1 5l3 3 6-7" stroke={read ? on : off} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5l3 3 6-7" stroke={read ? on : off} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
