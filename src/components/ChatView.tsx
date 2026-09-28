"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./ChatView.module.css";

interface Props {
  onBack: () => void;
}

type MessageType = "text" | "voice" | "image" | "video";

interface Message {
  id: number;
  text?: string;
  mediaUrl?: string;
  from: "me" | "babe";
  time: string;
  type: MessageType;
  read?: boolean;
}

const initialMessages: Message[] = [
  { id: 1, from: "babe", text: "Hey! what are you doing", time: "9:01", type: "text" },
  { id: 2, from: "me", text: "just chilling 😎", time: "9:01", type: "text", read: true },
  { id: 3, from: "babe", text: "", time: "9:02", type: "voice" },
  { id: 4, from: "babe", text: "nicee! wanna hang out later?", time: "9:03", type: "text" },
  { id: 5, from: "me", text: "yesss!", time: "9:04", type: "text", read: true },
  { id: 6, from: "me", text: "I'll text you when I'm free!", time: "9:04", type: "text", read: true },
  { id: 7, from: "babe", text: "okayyy!", time: "9:04", type: "text" },
];

const AUTO_REPLIES = [
  "I love you! 🧡", "Haha yes!!", "You're so cute", "Miss you too 🥺",
  "Can't wait to see you", "Always thinking of you", "You made my day",
];

export default function ChatView({ onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const send = () => {
    if (!input.trim()) return;
    const msg: Message = {
      id: Date.now(), from: "me", text: input.trim(), time: now(), type: "text", read: false,
    };
    setMessages(prev => [...prev, msg]);
    setInput("");
    triggerReply();
  };

  const triggerReply = () => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: Date.now() + 1, from: "babe",
        text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
        time: now(), type: "text",
      };
      setMessages(prev => [...prev, reply]);
    }, 2000);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => {
    if (!e.target.files?.[0]) return;
    const url = URL.createObjectURL(e.target.files[0]);
    const msg: Message = {
      id: Date.now(), from: "me", mediaUrl: url, time: now(), type, read: false,
    };
    setMessages(prev => [...prev, msg]);
    setShowAttach(false);
    triggerReply();
    e.target.value = "";
  };

  return (
    <div className={styles.chatView}>
      {/* Header */}
      <header className={styles.header}>
        <button id="btn-chat-back" className={styles.backBtn} onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className={styles.avatarWrap}>
          <img
            src="https://ui-avatars.com/api/?name=My+Babe&background=F97316&color=fff&size=80"
            alt="Babe"
            className={styles.avatarImg}
          />
          <span className={styles.onlineBadge} />
        </div>

        <div className={styles.chatInfo}>
          <p className={styles.chatName}>My Babe</p>
          <p className={styles.chatStatus}>Online</p>
        </div>

        <div className={styles.headerActions}>
          <button id="btn-call" className={styles.iconBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17.09l.1-.1a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button id="btn-video" className={styles.iconBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        <div className={styles.dateLabel}>Today</div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.row} ${msg.from === "me" ? styles.rowMe : styles.rowBabe}`}
          >
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
                  {msg.time}
                  {msg.from === "me" && <DoubleCheck read={msg.read} />}
                </span>
              </div>
            )}
          </div>
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

      {/* Input bar */}
      <div className={styles.inputBar}>
        <button
          id="btn-attach"
          className={styles.inputIconLeft}
          onClick={() => setShowAttach(v => !v)}
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
            className={styles.msgInput}
            placeholder="Message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
        </div>

        <button id="btn-voice" className={styles.voiceBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {input.trim() && (
          <button id="btn-send" className={styles.sendBtn} onClick={send}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
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
