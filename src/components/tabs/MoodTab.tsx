"use client";

import { useState } from "react";
import styles from "./MoodTab.module.css";

// SVG face component — expression changes per mood
function MoodFace({ mood }: { mood: string }) {
  const faces: Record<string, React.ReactNode> = {
    Happy: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#FBBF24" stroke="#F59E0B" strokeWidth="2"/>
        {/* Eyes */}
        <ellipse cx="34" cy="40" rx="9" ry="11" fill="#1a1a1a"/>
        <ellipse cx="66" cy="40" rx="9" ry="11" fill="#1a1a1a"/>
        {/* Eye shine */}
        <circle cx="30" cy="36" r="3.5" fill="white"/>
        <circle cx="62" cy="36" r="3.5" fill="white"/>
        {/* Happy smile */}
        <path d="M30 58 Q50 76 70 58" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
        {/* Rosy cheeks */}
        <ellipse cx="22" cy="60" rx="8" ry="5" fill="#F97316" opacity="0.3"/>
        <ellipse cx="78" cy="60" rx="8" ry="5" fill="#F97316" opacity="0.3"/>
      </svg>
    ),
    Excited: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#F97316" stroke="#EA580C" strokeWidth="2"/>
        <ellipse cx="34" cy="38" rx="9" ry="12" fill="#1a1a1a"/>
        <ellipse cx="66" cy="38" rx="9" ry="12" fill="#1a1a1a"/>
        <circle cx="30" cy="33" r="3.5" fill="white"/>
        <circle cx="62" cy="33" r="3.5" fill="white"/>
        {/* Wide open mouth */}
        <ellipse cx="50" cy="65" rx="16" ry="11" fill="#1a1a1a"/>
        <ellipse cx="50" cy="68" rx="13" ry="8" fill="#dc2626"/>
        <ellipse cx="50" cy="74" rx="9" ry="4" fill="#fca5a5"/>
        <ellipse cx="22" cy="58" rx="8" ry="5" fill="#f97316" opacity="0.4"/>
        <ellipse cx="78" cy="58" rx="8" ry="5" fill="#f97316" opacity="0.4"/>
      </svg>
    ),
    Sad: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#93C5FD" stroke="#60A5FA" strokeWidth="2"/>
        {/* Sad droopy eyes */}
        <ellipse cx="34" cy="42" rx="9" ry="10" fill="#1a1a1a"/>
        <ellipse cx="66" cy="42" rx="9" ry="10" fill="#1a1a1a"/>
        <circle cx="30" cy="38" r="3" fill="white"/>
        <circle cx="62" cy="38" r="3" fill="white"/>
        {/* Sad eyebrows */}
        <path d="M25 28 Q34 32 43 28" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M57 28 Q66 32 75 28" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Sad frown */}
        <path d="M32 66 Q50 54 68 66" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
        {/* Tear */}
        <ellipse cx="70" cy="56" rx="3" ry="4" fill="#60A5FA" opacity="0.9"/>
      </svg>
    ),
    Angry: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#FCA5A5" stroke="#F87171" strokeWidth="2"/>
        <ellipse cx="34" cy="44" rx="9" ry="10" fill="#1a1a1a"/>
        <ellipse cx="66" cy="44" rx="9" ry="10" fill="#1a1a1a"/>
        <circle cx="30" cy="40" r="3" fill="white"/>
        <circle cx="62" cy="40" r="3" fill="white"/>
        {/* Angry V-brows */}
        <path d="M22 28 L42 36" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
        <path d="M78 28 L58 36" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
        {/* Angry grimace */}
        <path d="M32 67 Q50 60 68 67" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <path d="M36 71 Q50 66 64 71" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    Calm: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#A7F3D0" stroke="#6EE7B7" strokeWidth="2"/>
        {/* Calm half-closed eyes */}
        <ellipse cx="34" cy="42" rx="9" ry="7" fill="#1a1a1a"/>
        <ellipse cx="66" cy="42" rx="9" ry="7" fill="#1a1a1a"/>
        <circle cx="31" cy="39" r="2.5" fill="white"/>
        <circle cx="63" cy="39" r="2.5" fill="white"/>
        {/* Gentle flat smile */}
        <path d="M34 62 Q50 70 66 62" stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    Tired: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#C4B5FD" stroke="#A78BFA" strokeWidth="2"/>
        {/* Half-closed droopy eyes */}
        <ellipse cx="34" cy="44" rx="9" ry="8" fill="#1a1a1a"/>
        <ellipse cx="66" cy="44" rx="9" ry="8" fill="#1a1a1a"/>
        {/* Heavy eyelids */}
        <rect x="24" y="36" width="20" height="8" rx="4" fill="#C4B5FD"/>
        <rect x="56" y="36" width="20" height="8" rx="4" fill="#C4B5FD"/>
        <circle cx="30" cy="42" r="2.5" fill="white"/>
        <circle cx="62" cy="42" r="2.5" fill="white"/>
        {/* Flat tired mouth */}
        <path d="M36 64 Q50 64 64 64" stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        {/* ZZZ */}
        <text x="70" y="30" fontSize="10" fill="#7C3AED" fontWeight="bold" fontFamily="Sora">z</text>
        <text x="75" y="22" fontSize="8" fill="#7C3AED" fontWeight="bold" fontFamily="Sora">z</text>
      </svg>
    ),
    Neutral: (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
        <ellipse cx="34" cy="42" rx="9" ry="10" fill="#1a1a1a"/>
        <ellipse cx="66" cy="42" rx="9" ry="10" fill="#1a1a1a"/>
        <circle cx="30" cy="38" r="3" fill="white"/>
        <circle cx="62" cy="38" r="3" fill="white"/>
        {/* Flat line mouth */}
        <path d="M34 63 Q50 63 66 63" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    "In Love": (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#FCA5A5" stroke="#F87171" strokeWidth="2"/>
        {/* Heart eyes */}
        <path d="M26 33 C26 28, 32 24, 36 30 C40 24, 46 28, 46 33 C46 38, 36 46, 36 46 C36 46, 26 38, 26 33Z" fill="#dc2626"/>
        <path d="M54 33 C54 28, 60 24, 64 30 C68 24, 74 28, 74 33 C74 38, 64 46, 64 46 C64 46, 54 38, 54 33Z" fill="#dc2626"/>
        {/* Big smile */}
        <path d="M30 60 Q50 80 70 60" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <ellipse cx="22" cy="60" rx="8" ry="5" fill="#F97316" opacity="0.35"/>
        <ellipse cx="78" cy="60" rx="8" ry="5" fill="#F97316" opacity="0.35"/>
      </svg>
    ),
    "Missing You": (
      <svg viewBox="0 0 100 100" className={styles.facesvg}>
        <circle cx="50" cy="50" r="46" fill="#FDE68A" stroke="#FCD34D" strokeWidth="2"/>
        <ellipse cx="34" cy="41" rx="9" ry="10" fill="#1a1a1a"/>
        <ellipse cx="66" cy="41" rx="9" ry="10" fill="#1a1a1a"/>
        <circle cx="30" cy="37" r="3" fill="white"/>
        <circle cx="62" cy="37" r="3" fill="white"/>
        {/* Wobbly unsure mouth */}
        <path d="M32 63 Q41 57 50 63 Q59 69 68 63" stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        {/* Small tear */}
        <ellipse cx="38" cy="56" rx="2.5" ry="3.5" fill="#93C5FD" opacity="0.9"/>
      </svg>
    ),
  };

  return faces[mood] ?? faces["Happy"];
}

const moods = [
  { label: "Happy",       color: "#FBBF24", bg: "#FFF8E7", miniColor: "#F59E0B" },
  { label: "In Love",     color: "#F87171", bg: "#FFF0F0", miniColor: "#EF4444" },
  { label: "Excited",     color: "#F97316", bg: "#FFF3E8", miniColor: "#EA580C" },
  { label: "Calm",        color: "#10B981", bg: "#ECFDF5", miniColor: "#059669" },
  { label: "Missing You", color: "#FBBF24", bg: "#FFFBEB", miniColor: "#D97706" },
  { label: "Tired",       color: "#8B5CF6", bg: "#F5F3FF", miniColor: "#7C3AED" },
  { label: "Sad",         color: "#60A5FA", bg: "#EFF6FF", miniColor: "#3B82F6" },
  { label: "Angry",       color: "#EF4444", bg: "#FEF2F2", miniColor: "#DC2626" },
  { label: "Neutral",     color: "#9CA3AF", bg: "#F9FAFB", miniColor: "#6B7280" },
];

const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
const initialWeekMoods: (string | null)[] = ["Happy", "In Love", null, "Missing You", "Calm", null, null];
const tabs = ["This Week", "Insights", "This Month"] as const;
type TabType = typeof tabs[number];

export default function MoodTab() {
  const [todayMood, setTodayMood] = useState(moods[0]);
  const [weekMoods, setWeekMoods] = useState<(string | null)[]>(initialWeekMoods);
  const [activeView, setActiveView] = useState<TabType>("This Week");
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState(false);
  const todayIdx = (new Date().getDay() + 6) % 7;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  const selectMood = (m: typeof moods[0]) => {
    setTodayMood(m);
    setWeekMoods(prev => {
      const next = [...prev];
      next[todayIdx] = m.label;
      return next;
    });
    setPicking(false);
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <div className={styles.tab}>

      {/* Hero */}
      <div className={styles.hero} style={{ background: todayMood.bg }}>
        <p className={styles.heroDate}>{today}</p>
        <p className={styles.heroToday}>Today</p>

        <div
          className={styles.faceWrap}
          style={{ filter: `drop-shadow(0 12px 24px ${todayMood.color}55)` }}
        >
          <MoodFace mood={todayMood.label} />
        </div>

        <p className={styles.heroLabel} style={{ color: todayMood.color }}>
          {todayMood.label}
        </p>

        {sent && <p className={styles.sentMsg}>Mood shared with babe!</p>}

        <button
          id="btn-change-mood"
          className={styles.changeBtn}
          style={{ background: todayMood.color, color: todayMood.color === "#FBBF24" || todayMood.color === "#FDE68A" ? "#1a1a1a" : "#fff" }}
          onClick={() => setPicking(v => !v)}
        >
          {picking ? "Cancel" : "Change Mood"}
        </button>
      </div>

      {/* Mood Picker Sheet */}
      {picking && (
        <div className={styles.pickerSheet} onClick={() => setPicking(false)}>
          <div className={styles.pickerContent} onClick={e => e.stopPropagation()}>
            <div className={styles.pickerHandle} />
            <p className={styles.pickerTitle}>How are you feeling?</p>
            <div className={styles.moodGrid}>
              {moods.map(m => (
                <button
                  key={m.label}
                  className={`${styles.moodOption} ${todayMood.label === m.label ? styles.moodOptionActive : ""}`}
                  style={{ "--mc": m.color, "--mbg": m.bg } as React.CSSProperties}
                  onClick={() => selectMood(m)}
                >
                  <div className={styles.moodFaceSmall}>
                    <MoodFace mood={m.label} />
                  </div>
                  <span className={styles.moodOptionLabel}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom panel */}
      <div className={styles.panel}>
        {/* Tab row */}
        <div className={styles.tabRow}>
          {tabs.map(t => (
            <button
              key={t}
              className={`${styles.tabBtn} ${activeView === t ? styles.tabBtnActive : ""}`}
              style={activeView === t ? { background: todayMood.color, color: todayMood.color === "#FBBF24" ? "#1a1a1a" : "#fff" } : {}}
              onClick={() => setActiveView(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {activeView === "This Week" && (
          <>
            <div className={styles.weekRow}>
              {weekDays.map((d, i) => {
                const moodLabel = weekMoods[i];
                const isToday = i === todayIdx;
                return (
                  <div key={i} className={styles.dayCol}>
                    <span className={styles.dayLetter}>{d}</span>
                    <div className={`${styles.dayCircle} ${isToday ? styles.dayToday : ""}`}
                      style={isToday ? { borderColor: todayMood.color } : {}}>
                      {moodLabel
                        ? <div className={styles.miniMoodFace}><MoodFace mood={moodLabel} /></div>
                        : <div className={styles.dayEmpty} />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            <p className={styles.weekNote}>
              You checked in {weekMoods.filter(Boolean).length} days this week
            </p>
          </>
        )}

        {activeView === "Insights" && (
          <div className={styles.insightWrap}>
            <div className={styles.insightRow}>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>Most frequent</span>
                <div className={styles.insightFace}><MoodFace mood="Happy" /></div>
                <strong className={styles.insightVal}>Happy</strong>
              </div>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>Babe&apos;s top mood</span>
                <div className={styles.insightFace}><MoodFace mood="In Love" /></div>
                <strong className={styles.insightVal}>In Love</strong>
              </div>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>Streak</span>
                <div className={styles.streakNum}>5</div>
                <strong className={styles.insightVal}>days</strong>
              </div>
            </div>
          </div>
        )}

        {activeView === "This Month" && (
          <p className={styles.comingSoon}>Monthly view coming soon ✨</p>
        )}
      </div>

      <div style={{ height: 80 }} />
    </div>
  );
}
