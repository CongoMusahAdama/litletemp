"use client";

import styles from "./StreakScreen.module.css";
import { FaceCluster, type FaceKind } from "./MoodFaces";

export type StreakState = "start" | "saved" | "waiting" | "expiring" | "lost";

interface Props {
  streak: number;
  state: StreakState;
  hoursLeft: number;
  partnerName: string;
  onClose: () => void;
  onSnap: () => void;
  onCheckIn: () => void;
}

// Snapchat-style milestones: each level unlocks at a day count.
const LEVELS = [
  { days: 0, name: "New flame", emoji: "🕯️" },
  { days: 3, name: "Spark", emoji: "✨" },
  { days: 7, name: "On fire", emoji: "🔥" },
  { days: 14, name: "Hot", emoji: "🌶️" },
  { days: 30, name: "Blazing", emoji: "☄️" },
  { days: 50, name: "Inferno", emoji: "🌋" },
  { days: 100, name: "Century", emoji: "💯" },
  { days: 365, name: "Forever", emoji: "👑" },
];

const MOOD: Record<StreakState, FaceKind> = {
  saved: "smile",
  waiting: "laugh",
  expiring: "shock",
  lost: "angry",
  start: "neutral",
};

export default function StreakScreen({ streak, state, hoursLeft, partnerName, onClose, onSnap, onCheckIn }: Props) {
  const levelIndex = LEVELS.reduce((found, level, index) => (streak >= level.days ? index : found), 0);
  const level = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1];
  const progress = next ? (streak - level.days) / (next.days - level.days) : 1;

  const title = state === "lost" ? "Your streak ended" : streak > 0 ? `${streak} day streak` : "Start a streak";
  const subtitle = {
    saved: `You and ${partnerName} both showed up today. See you tomorrow.`,
    waiting: `You checked in. ${partnerName} still needs to send something today.`,
    expiring: `Only ${hoursLeft}h left. Send a snap to keep it alive.`,
    lost: `Snap ${partnerName} today to start a new one.`,
    start: `Send each other something every day to grow your flame.`,
  }[state];

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close streak">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <FaceCluster highlight={MOOD[state]} />

      <div className={styles.body}>
        <div className={`${styles.flame} ${state === "expiring" ? styles.flameHot : ""} ${state === "lost" ? styles.flameCold : ""}`}>
          <span>{state === "expiring" ? "⏳" : level.emoji}</span>
          {streak > 0 && state !== "lost" && <strong>{streak}</strong>}
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        <div className={styles.levelCard}>
          <div className={styles.levelHead}>
            <span>Level {levelIndex + 1} · {level.name}</span>
            {next && <span className={styles.levelNext}>{next.days - streak} days to {next.emoji}</span>}
          </div>
          <div className={styles.levelBar}>
            <div className={styles.levelFill} style={{ width: `${Math.max(4, Math.min(100, progress * 100))}%` }} />
          </div>
          <div className={styles.levelRow}>
            {LEVELS.slice(1).map((item) => (
              <div key={item.days} className={`${styles.levelDot} ${streak >= item.days ? styles.levelDotOn : ""}`}>
                <span>{item.emoji}</span>
                <small>{item.days}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cta} onClick={onSnap}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Send a Snap
        </button>
        {state !== "saved" && (
          <button type="button" className={styles.secondary} onClick={onCheckIn}>
            Just check in for today
          </button>
        )}
      </div>
    </div>
  );
}
