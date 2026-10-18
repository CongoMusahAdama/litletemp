"use client";

import { useEffect, useState } from "react";
import styles from "./HeartBurst.module.css";
import { api } from "@/lib/api";

export function sendNudge(emoji = "💗") {
  return api<{ ok: boolean }>("/api/nudge", { method: "POST", body: JSON.stringify({ emoji }) });
}

interface Props {
  name: string;
  emoji: string;
  onDone: () => void;
}

// Spread the hearts out without randomness so every render looks the same.
const HEARTS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 6) * 0.18 + Math.floor(i / 6) * 0.12,
  size: 22 + ((i * 13) % 26),
  drift: ((i * 29) % 60) - 30,
}));

export default function HeartBurst({ name, emoji, onDone }: Props) {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    navigator.vibrate?.([80, 60, 80, 60, 220]);
    const timer = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const sendBack = () => {
    setSent(true);
    sendNudge(emoji).catch(() => undefined);
    window.setTimeout(onDone, 900);
  };

  return (
    <div className={styles.burst} onClick={onDone}>
      {HEARTS.map((heart, index) => (
        <span
          key={index}
          className={styles.heart}
          style={{
            left: `${heart.left}%`,
            fontSize: heart.size,
            animationDelay: `${heart.delay}s`,
            ["--drift" as string]: `${heart.drift}px`,
          }}
        >
          {index % 3 === 0 ? emoji : "♥"}
        </span>
      ))}
      <div className={styles.card} onClick={(event) => event.stopPropagation()}>
        <span className={styles.big}>{emoji}</span>
        <p className={styles.text}><strong>{name}</strong> is thinking of you</p>
        <button type="button" className={styles.back} onClick={sendBack} disabled={sent}>
          {sent ? "Sent 💗" : "Send one back"}
        </button>
      </div>
    </div>
  );
}
