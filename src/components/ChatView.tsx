"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import styles from "./ChatView.module.css";
import { API_URL, api, getToken, mediaUrl, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import EmojiPicker from "./EmojiPicker";

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
  const { user, partner, couple } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  
  // Call state
  const [callState, setCallState] = useState<"idle" | "calling" | "connected">("idle");
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [isMuted, setIsMuted] = useState(false);

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
  const [streakNote, setStreakNote] = useState("");

  // Audio Recording Ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const bottomRef = useRef<HTMLDivElement>(null);
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
    socket.on("message:new", (data: ServerMessage) => {
      setMessages((prev) => prev.some((item) => item.id === String(data.id)) ? prev : [...prev, asView(data)]);
      setIsTyping(false);
      if (String(data.senderId) !== String(user.id)) {
        api("/api/chat/read", { method: "POST" }).catch(() => undefined);
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
    socket.on("streak:updated", (payload: { streak: number }) => setStreak(payload.streak));

    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (couple?.wallpaperUrl) setWallpaper(mediaUrl(couple.wallpaperUrl));
  }, [couple?.wallpaperUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Simulate calling flow
  useEffect(() => {
    if (callState === "calling") {
      const timer = setTimeout(() => {
        setCallState("connected");
      }, 3000); // 3 seconds to "connect"
      return () => clearTimeout(timer);
    }
  }, [callState]);

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
      api(`/api/chat/messages/${id}`, { method: "PATCH", body: JSON.stringify({ text }) }).catch(() => undefined);
      return;
    }

    const replyToId = replyingToMsg?.id;
    setInput("");
    setReplyingToMsg(null);
    socketRef.current?.emit("typing", false);
    socketRef.current?.emit("message:send", { text: input.trim(), type: "text", replyToId });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setShowAttach(false);
    try {
      const uploaded = await uploadFile(file);
      socketRef.current?.emit("message:send", { type, mediaUrl: uploaded.url });
    } catch {
      // The composer stays available if the upload fails.
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

  const startCall = (type: "voice" | "video") => {
    setCallType(type);
    setCallState("calling");
    setIsMuted(false);
  };

  const endCall = () => {
    setCallState("idle");
  };

  const startRecording = async () => {
    setIsRecording(true);
    setRecordingTime(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingTime > 0) {
          const file = new File([audioBlob], "voice.webm", { type: "audio/webm" });
          uploadFile(file)
            .then((uploaded) => socketRef.current?.emit("message:send", { type: "voice", mediaUrl: uploaded.url }))
            .catch(() => undefined);
        }
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      setRecordingTime(0);
    }
  };

  const handleMessageContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: Message) => {
    e.preventDefault();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    setContextMenu({ msgId: msg.id, x: clientX, y: clientY, isMe: msg.from === "me" });
  };

  const handleDeleteMessage = (id: string) => {
    setContextMenu(null);
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

  // Click outside context menu to close it
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={styles.chatView}>
      
      {/* ── Call Overlay ── */}
      {callState !== "idle" && (
        <div className={`${styles.callOverlay} ${callType === "video" ? styles.callOverlayVideo : ""}`}>
          
          {callType === "video" && (
            <img 
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop" 
              className={styles.callVideoBackground} 
              alt="Video Feed Simulation"
            />
          )}

          <div className={styles.callHeader}>
            {callType === "voice" && (
              <img
                src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || "Babe")}&background=F97316&color=fff&size=200`}
                alt="Partner"
                className={styles.callAvatar}
              />
            )}
            <h2 className={styles.callName}>{partner?.name || couple?.expectedPartnerName || "My Babe"}</h2>
            <p className={styles.callStatus}>
              {callState === "calling" ? "Ringing..." : "00:14"}
            </p>
          </div>

          <div className={styles.callControls}>
            <button 
              className={`${styles.controlBtn} ${isMuted ? styles.controlBtnActive : ""}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
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
            
            <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={endCall}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </button>
            
            {callType === "video" ? (
              <button className={styles.controlBtn}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
            ) : (
              <button className={styles.controlBtn}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
            )}
          </div>
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
            src={partner?.avatarUrl ? mediaUrl(partner.avatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || couple?.expectedPartnerName || "Babe")}&background=F97316&color=fff&size=80`}
            alt="Partner"
            className={styles.avatarImg}
          />
          <span className={styles.onlineBadge} />
        </div>

        <div className={styles.chatInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p className={styles.chatName}>{partner?.name || couple?.expectedPartnerName || "My Babe"}</p>
            <button className={styles.streakBtn} onClick={async () => {
              try {
                const result = await api<{ streak: number; partnerCheckedIn: boolean }>("/api/chat/streak", { method: "POST" });
                setStreak(result.streak);
                setStreakNote(result.partnerCheckedIn ? "Streak kept for today" : "Saved. Your person still needs to tap");
              } catch {
                setStreakNote("Could not save the streak");
              }
            }}>
              🔥 {streak}
            </button>
          </div>
          <p className={styles.chatStatus}>{streakNote || (partnerOnline ? "Online" : couple?.status === "pending" ? "Waiting to join" : "Offline")}</p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => wallpaperInputRef.current?.click()} title="Change Wallpaper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button id="btn-call" className={styles.iconBtn} onClick={() => startCall("voice")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button id="btn-video" className={styles.iconBtn} onClick={() => startCall("video")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setContextMenu(null)}>
          <div 
            style={{ 
              position: 'absolute', left: contextMenu.x, top: contextMenu.y, 
              background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '8px 0', minWidth: '150px', transform: 'translate(-50%, -100%)', marginTop: '-10px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button className={styles.contextMenuItem} onClick={() => handleReplyMessage(messages.find(m => m.id === contextMenu.msgId)!)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              Reply
            </button>
            {contextMenu.isMe && (
              <>
                <button className={styles.contextMenuItem} onClick={() => handleEditMessage(messages.find(m => m.id === contextMenu.msgId)!)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className={styles.contextMenuItem} onClick={() => handleDeleteMessage(contextMenu.msgId)} style={{ color: '#ef4444' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        className={styles.messages} 
        style={wallpaper ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
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
                   <p className={styles.bubbleText}>🚫 This message was deleted</p>
                 </div>
              ) : (
                <div 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === 'me' ? 'flex-end' : 'flex-start' }}
                  onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => handleMessageContextMenu(e, msg), 600);
                    e.currentTarget.dataset.timer = timer.toString();
                  }}
                  onTouchEnd={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                  onTouchMove={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                >
                  {repliedMsg && (
                    <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px 10px', borderRadius: '8px', marginBottom: '4px', fontSize: '12px', borderLeft: `3px solid ${msg.from === 'me' ? '#1a1a1a' : '#FBBF24'}`, opacity: 0.8, maxWidth: '200px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{repliedMsg.from === 'me' ? 'You' : 'Babe'}</div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {repliedMsg.isDeleted ? 'Deleted message' : repliedMsg.type === 'text' ? repliedMsg.text : `[${repliedMsg.type}]`}
                      </div>
                    </div>
                  )}

                  {msg.type === "image" && msg.mediaUrl && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe} ${styles.mediaBubble}`}>
                      <img src={msg.mediaUrl} alt="sent" className={styles.mediaImg} />
                      <span className={styles.bubbleTime}>
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} />}
                      </span>
                    </div>
                  )}

                  {msg.type === "video" && msg.mediaUrl && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe} ${styles.mediaBubble}`}>
                      <video src={msg.mediaUrl} controls className={styles.mediaImg} />
                      <span className={styles.bubbleTime}>
                        {msg.time}
                        {msg.from === "me" && <DoubleCheck read={msg.read} />}
                      </span>
                    </div>
                  )}

                  {msg.type === "voice" && (
                    <div className={`${styles.bubble} ${msg.from === "me" ? styles.bubbleMe : styles.bubbleBabe}`}>
                      <div className={styles.voiceMsg}>
                        {msg.mediaUrl ? (
                          <audio src={msg.mediaUrl} controls style={{ width: '200px', height: '36px' }} />
                        ) : (
                          <>
                            <button className={styles.playBtn}>
                              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </button>
                            <div className={styles.waveform}>
                              {Array.from({ length: 22 }).map((_, i) => (
                                <div key={i} className={styles.bar} style={{ height: `${[3,6,10,14,8,12,5,9,16,11,7,13,6,10,4,8,15,9,5,11,7,3][i] || 5}px` }} />
                              ))}
                            </div>
                            <span className={styles.voiceDur}>0:07</span>
                          </>
                        )}
                      </div>
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

      {showEmoji && <EmojiPicker onPick={addEmoji} />}

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
      <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        
        {/* Reply/Edit Banner */}
        {(replyingToMsg || editingMsgId) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '3px solid #FBBF24', paddingLeft: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FBBF24' }}>
                {editingMsgId ? 'Editing Message' : `Replying to ${replyingToMsg?.from === 'me' ? 'yourself' : 'Babe'}`}
              </span>
              <span style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                {editingMsgId ? messages.find(m => m.id === editingMsgId)?.text : (replyingToMsg?.type === 'text' ? replyingToMsg.text : `[${replyingToMsg?.type}]`)}
              </span>
            </div>
            <button 
              onClick={() => { setReplyingToMsg(null); setEditingMsgId(null); setInput(""); }}
              style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        <div className={styles.inputBar} style={{ borderTop: 'none' }}>
          {isRecording ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', color: '#ef4444', animation: 'fadeIn 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'pulseAvatar 1s infinite' }} />
                <span style={{ fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>Release to send</span>
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
                  className={styles.emojiToggle}
                  aria-label="Emojis"
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

          <button 
            id="btn-voice" 
            className={styles.voiceBtn}
            style={{ transform: isRecording ? 'scale(1.3)' : 'scale(1)' }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

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

function DoubleCheck({ read }: { read?: boolean }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5l3 3 6-7" stroke={read ? "#1a1a1a" : "rgba(26,26,26,0.4)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5l3 3 6-7" stroke={read ? "#1a1a1a" : "rgba(26,26,26,0.4)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
