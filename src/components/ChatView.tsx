"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import styles from "./ChatView.module.css";
import { API_URL, api, getToken, mediaUrl, shownName, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import EmojiPicker from "./EmojiPicker";
import { useCoupleCall } from "@/hooks/useCoupleCall";
import { showHomeBadge } from "@/lib/badge";

interface Props {
  onBack: () => void;
}

type MessageType = "text" | "voice" | "image" | "video";

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
}

type ServerMessage = Omit<Message, "from"> & { senderId: string };

export default function ChatView({ onBack }: Props) {
  const { user, partner, couple, refresh } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const call = useCoupleCall(socket);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wallpaper state
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  // Message Actions state
  const [contextMenu, setContextMenu] = useState<{ msgId: string, x: number, y: number, isMe: boolean } | null>(null);
  const [replyingToMsg, setReplyingToMsg] = useState<Message | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [streak, setStreak] = useState(couple?.currentStreak || 0);
  const [streakState, setStreakState] = useState<"start" | "saved" | "waiting" | "expiring" | "lost">("start");
  const [streakHours, setStreakHours] = useState(0);
  const [draftMedia, setDraftMedia] = useState<{ file: File; kind: "image" | "video"; preview: string } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; kind: "image" | "video" } | null>(null);
  const chatTitle = shownName(partner)
    || (couple?.expectedPartnerName && couple.expectedPartnerName !== user?.name ? couple.expectedPartnerName : "")
    || "My Babe";
  const [streakNote, setStreakNote] = useState("");

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
  const messageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Socket state
  const socketRef = useRef<Socket | null>(null);

  const asView = (data: ServerMessage): Message => ({
    ...data,
    id: String(data.id),
    mediaUrl: data.mediaUrl ? mediaUrl(data.mediaUrl) : undefined,
    replyToId: data.replyToId ? String(data.replyToId) : null,
    from: String(data.senderId) === String(user?.id) ? "me" : "babe",
  });

  useEffect(() => {
    if (!user) return;
    api<ServerMessage[]>("/api/chat/messages")
      .then((rows) => setMessages(rows.map(asView)))
      .catch(() => setMessages([]));
    api("/api/chat/read", { method: "POST" }).catch(() => undefined);

    const socket = io(API_URL, { auth: { token: getToken() } });
    socketRef.current = socket;
    setSocket(socket);
    socket.on("message:new", (data: ServerMessage) => {
      setMessages((prev) => prev.some((item) => item.id === String(data.id)) ? prev : [...prev, asView(data)]);
      setIsTyping(false);
      if (String(data.senderId) !== String(user.id)) {
        playMessageNote();
        if (document.visibilityState === "visible") {
          api("/api/chat/read", { method: "POST" }).catch(() => undefined);
        } else {
          void showHomeBadge();
        }
      } else {
        playSendTick();
      }
    });
    socket.on("message:updated", (data: ServerMessage) => {
      setMessages((prev) => prev.map((item) => item.id === String(data.id) ? asView(data) : item));
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
    socket.on("partner:updated", () => {
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
    if (couple?.wallpaperUrl) setWallpaper(mediaUrl(couple.wallpaperUrl));
  }, [couple?.wallpaperUrl]);

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

  const send = () => {
    if (!input.trim()) return;

    if (editingMsgId) {
      const text = input.trim();
      const id = editingMsgId;
      setEditingMsgId(null);
      setInput("");
      setMessages((prev) => prev.map((item) => item.id === id ? { ...item, text, isEdited: true } : item));
      api(`/api/chat/messages/${id}`, { method: "PATCH", body: JSON.stringify({ text }) }).catch(() => undefined);
      return;
    }

    const replyToId = replyingToMsg?.id;
    setInput("");
    setReplyingToMsg(null);
    socketRef.current?.emit("typing", false);
    socketRef.current?.emit("message:send", { text: input.trim(), type: "text", replyToId });
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
      socketRef.current?.emit("message:send", { type: draftMedia.kind, mediaUrl: uploaded.url });
      URL.revokeObjectURL(draftMedia.preview);
      setDraftMedia(null);
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
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
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
      recordingTimerRef.current = setInterval(() => {
        const rec = recRef.current;
        if (rec) setRecordingTime(Math.floor((Date.now() - rec.started) / 1000));
      }, 250);
    } catch {
      void ctx.close();
      setIsRecording(false);
      setStreakNote("Allow the microphone, then try the voice note again");
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

  const openMessageMenu = (msg: Message) => {
    menuOpenedAt.current = Date.now();
    setContextMenu({ msgId: msg.id, x: 0, y: 0, isMe: msg.from === "me" });
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

  return (
    <div className={styles.chatView}>
      
      {/* ── Call Overlay ── */}
      {call.phase !== "idle" && (
        <div className={`${styles.callOverlay} ${call.callType === "video" ? styles.callOverlayVideo : ""}`}>
          <audio ref={call.remoteAudioRef} autoPlay playsInline />
          {call.callType === "video" && (
            <>
              <video ref={call.remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />
              <video ref={call.localVideoRef} className={styles.localVideo} autoPlay playsInline muted />
            </>
          )}

          <div className={styles.callHeader}>
            {call.callType === "voice" && (
              <img
                src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}&background=F97316&color=fff&size=200`}
                alt=""
                className={styles.callAvatar}
              />
            )}
            <h2 className={styles.callName}>{chatTitle}</h2>
            <p className={styles.callStatus}>
              {call.phase === "incoming"
                ? (call.callType === "video" ? "Incoming video call" : "Incoming voice call")
                : call.phase === "calling"
                  ? "Ringing..."
                  : `${String(Math.floor(call.seconds / 60)).padStart(2, "0")}:${String(call.seconds % 60).padStart(2, "0")}`}
            </p>
          </div>

          {call.phase === "incoming" ? (
            <div className={styles.callControls}>
              <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={call.decline} aria-label="Decline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
              </button>
              <button className={`${styles.controlBtn} ${styles.acceptCallBtn}`} onClick={call.accept} aria-label="Accept">
                {call.callType === "video" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className={styles.callControls}>
              <button
                className={`${styles.controlBtn} ${call.muted ? styles.controlBtnActive : ""}`}
                onClick={call.toggleMute}
                aria-label={call.muted ? "Unmute" : "Mute"}
              >
                {call.muted ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={call.hangup} aria-label="End call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
              </button>

              {call.callType === "video" ? (
                <button
                  className={`${styles.controlBtn} ${call.cameraOn ? "" : styles.controlBtnActive}`}
                  onClick={call.toggleCamera}
                  aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>
              ) : (
                <span className={styles.controlSpacer} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <button id="btn-chat-back" className={styles.backBtn} onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className={styles.avatarWrap}>
          <img
            src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}&background=F97316&color=fff&size=80`}
            alt="Partner"
            className={styles.avatarImg}
          />
          <span className={styles.onlineBadge} />
        </div>

        <div className={styles.chatInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <p className={styles.chatName}>{chatTitle}</p>
            <button className={`${styles.streakBtn} ${streakState === "expiring" ? styles.streakHot : ""} ${streakState === "lost" ? styles.streakCold : ""}`} onClick={async () => {
              try {
                const result = await api<{ streak: number; state: "start" | "saved" | "waiting" | "expiring" | "lost"; hoursLeft: number; partnerCheckedIn: boolean }>("/api/chat/streak", { method: "POST" });
                setStreak(result.streak);
                setStreakState(result.state);
                setStreakHours(result.hoursLeft);
                setStreakNote(result.partnerCheckedIn ? "Streak kept for today" : "Saved. They still need to check in");
              } catch {
                setStreakNote("Could not save the streak");
              }
            }}>
              🔥 {streak}
            </button>
          </div>
          <p className={styles.chatStatus}>{call.notice || streakNote || (partnerOnline ? "Online" : couple?.status === "pending" ? "Waiting to join" : "Offline")}</p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => wallpaperInputRef.current?.click()} title="Change Wallpaper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button id="btn-call" className={styles.iconBtn} onClick={() => call.start("voice")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button id="btn-video" className={styles.iconBtn} onClick={() => call.start("video")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          className={styles.menuScrim}
          onClick={() => {
            if (Date.now() - menuOpenedAt.current < 450) return;
            setContextMenu(null);
          }}
        >
          <div className={styles.menuSheet} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.contextMenuItem} onClick={() => handleReplyMessage(messages.find(m => m.id === contextMenu.msgId)!)}>
              Reply
            </button>
            {contextMenu.isMe && messages.find((item) => item.id === contextMenu.msgId)?.type === "text" && (
              <button type="button" className={styles.contextMenuItem} onClick={() => handleEditMessage(messages.find(m => m.id === contextMenu.msgId)!)}>
                Edit
              </button>
            )}
            {contextMenu.isMe && (
              <button type="button" className={`${styles.contextMenuItem} ${styles.menuDanger}`} onClick={() => handleDeleteMessage(contextMenu.msgId)}>
                Delete for everyone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesRef}
        className={styles.messages}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }} 
        style={wallpaper ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
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
        <div className={styles.dateLabel}>Today</div>

        {messages.map((msg) => {
          const repliedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
          
          return (
            <div
              key={msg.id}
              className={`${styles.row} ${msg.from === "me" ? styles.rowMe : styles.rowBabe}`}
            >
              {msg.isDeleted ? (
                 <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`} style={{ opacity: 0.6, fontStyle: 'italic' }}>
                   <p className={styles.bubbleText}>This message was deleted</p>
                 </div>
              ) : (
                <div 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === 'me' ? 'flex-end' : 'flex-start' }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openMessageMenu(msg);
                  }}
                  onTouchStart={(event) => {
                    const timer = window.setTimeout(() => openMessageMenu(msg), 450);
                    event.currentTarget.dataset.timer = String(timer);
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

                  {msg.type === "image" && msg.mediaUrl && (
                    <button type="button" className={styles.mediaFrame} onClick={() => setViewer({ url: msg.mediaUrl || "", kind: "image" })}>
                      <img src={msg.mediaUrl} alt="" className={styles.mediaImg} />
                      <span className={styles.mediaTime}>
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} light />}
                      </span>
                    </button>
                  )}

                  {msg.type === "video" && msg.mediaUrl && (
                    <button type="button" className={styles.mediaFrame} onClick={() => setViewer({ url: msg.mediaUrl || "", kind: "video" })}>
                      <video src={msg.mediaUrl} className={styles.mediaImg} muted playsInline preload="metadata" />
                      <span className={styles.playBadge}>▶</span>
                      <span className={styles.mediaTime}>
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} light />}
                      </span>
                    </button>
                  )}

                  {msg.type === "voice" && msg.mediaUrl && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`}>
                      <VoiceNote src={msg.mediaUrl} />
                      <span className={styles.bubbleTime}>
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} />}
                      </span>
                    </div>
                  )}

                  {msg.type === "text" && msg.text && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`}>
                      <p className={styles.bubbleText}>{msg.text}</p>
                      <span className={styles.bubbleTime}>
                        {msg.isEdited && <span style={{ marginRight: '4px', opacity: 0.6 }}>Edited</span>}
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} />}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

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

      {draftMedia && (
        <div className={styles.previewSheet}>
          {draftMedia.kind === "video"
            ? <video src={draftMedia.preview} className={styles.previewMedia} controls playsInline />
            : <img src={draftMedia.preview} alt="" className={styles.previewMedia} />}
          <div className={styles.previewActions}>
            <button type="button" onClick={() => { URL.revokeObjectURL(draftMedia.preview); setDraftMedia(null); }}>Cancel</button>
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
        </div>
      )}

      {showEmoji && <EmojiPicker onPick={addEmoji} onClose={() => setShowEmoji(false)} />}

      {/* Attach panel */}
      {showAttach && (
        <div className={styles.attachPanel}>
          <button className={styles.attachOption} onClick={() => fileInputRef.current?.click()}>
            <div className={styles.attachIcon} style={{ background: "#FBBF24" }}>
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
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={e => handleFile(e, "image")} style={{ display: "none" }} />
      <input type="file" accept="video/*" ref={videoInputRef} onChange={e => handleFile(e, "video")} style={{ display: "none" }} />
      <input type="file" accept="image/*" ref={wallpaperInputRef} onChange={handleWallpaperChange} style={{ display: "none" }} />

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
              <button type="button" className={styles.recordCancel} onClick={() => finishRecording(false)}>Cancel</button>
              <div className={styles.recordTime}>
                <span className={styles.recordDot} />
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
              </div>
              <button type="button" className={styles.previewSend} onClick={() => finishRecording(true)}>Send</button>
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
                <input
                  id="input-message"
                  ref={messageInputRef}
                  className={styles.msgInput}
                  placeholder="Message..."
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    socketRef.current?.emit("typing", e.target.value.length > 0);
                  }}
                  onKeyDown={e => e.key === "Enter" && send()}
                />
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

let noteContext: AudioContext | null = null;

function noteAudio() {
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!noteContext) noteContext = new Context();
  if (noteContext.state === "suspended") void noteContext.resume();
  return noteContext;
}

function playSendTick() {
  const context = noteAudio();
  if (!context) return;
  const sound = () => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  };
  if (context.state === "suspended") {
    void context.resume().then(sound);
    return;
  }
  sound();
}

function playMessageNote() {
  const context = noteAudio();
  if (!context) return;
  const now = context.currentTime;
  [659.25, 880].forEach((frequency, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const start = now + index * 0.11;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + 0.34);
  });
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

function VoiceNote({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const heights = [4, 8, 14, 10, 18, 8, 12, 6, 16, 9, 13, 7, 15, 5, 11, 8, 17, 6, 10, 14];
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };
  const clock = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
  return (
    <div className={styles.voiceMsg}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
      />
      <button type="button" className={styles.playBtn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div className={styles.waveform}>
        {heights.map((height, index) => (
          <div key={index} className={styles.bar} style={{ height, opacity: index / heights.length <= progress ? 1 : 0.35 }} />
        ))}
      </div>
      <span className={styles.voiceDur}>{clock(playing || progress ? (duration * progress) : duration)}</span>
    </div>
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
