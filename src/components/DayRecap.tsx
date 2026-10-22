"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./DayRecap.module.css";
import { api } from "@/lib/api";
import { Face, type FaceKind } from "./MoodFaces";
import type { Recap, RecapEntry } from "@/hooks/useRecap";

const MOODS: { rating: number; face: FaceKind; label: string }[] = [
  { rating: 1, face: "angry", label: "Rough" },
  { rating: 2, face: "shock", label: "Stressful" },
  { rating: 3, face: "neutral", label: "Okay" },
  { rating: 4, face: "smile", label: "Good" },
  { rating: 5, face: "laugh", label: "Amazing" },
];

const PROMPTS = ["The best part was ", "Something hard was ", "I'm grateful for ", "I missed you when "];

interface Props {
  recap: Recap | null;
  partnerName: string;
  onShare: (rating: number, text: string) => Promise<Recap>;
  onClose: () => void;
}

function niceDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function EntryCard({ who, entry, mine }: { who: string; entry: RecapEntry; mine?: boolean }) {
  if (!entry) return null;
  const mood = MOODS.find((item) => item.rating === entry.rating) || MOODS[2];
  return (
    <div className={`${styles.entry} ${mine ? styles.entryMine : ""}`}>
      <div className={styles.entryHead}>
        <span className={styles.entryFace}><Face kind={mood.face} /></span>
        <span>
          <strong>{who}</strong>
          <small>Had a {mood.label.toLowerCase()} day</small>
        </span>
      </div>
      <p>{entry.text}</p>
    </div>
  );
}

export default function DayRecap({ recap, partnerName, onShare, onClose }: Props) {
  const [tab, setTab] = useState<"today" | "past">("today");
  const [editing, setEditing] = useState(!recap?.mine);
  const [rating, setRating] = useState(recap?.mine?.rating || 0);
  const [text, setText] = useState(recap?.mine?.text || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Recap[] | null>(null);

  const submit = async () => {
    if (!rating || !text.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onShare(rating, text.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const openPast = () => {
    setTab("past");
    if (!history) api<Recap[]>("/api/recap/history").then(setHistory).catch(() => setHistory([]));
  };

  const addPrompt = (prompt: string) => setText((current) => (current.trim() ? `${current.trim()}\n${prompt}` : prompt));

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.sky}>
          <div className={styles.grip} />
          <span className={styles.moon} aria-hidden="true">🌙</span>
          <span className={`${styles.star} ${styles.starA}`} aria-hidden="true">✦</span>
          <span className={`${styles.star} ${styles.starB}`} aria-hidden="true">✦</span>
          <span className={`${styles.star} ${styles.starC}`} aria-hidden="true">✦</span>
          <p className={styles.kicker}>Evening check-in · {recap ? niceDay(recap.day) : "Today"}</p>
          <h2 className={styles.title}>How was your day?</h2>
          <div className={styles.tabs}>
            <button type="button" className={tab === "today" ? styles.tabOn : ""} onClick={() => setTab("today")}>Today</button>
            <button type="button" className={tab === "past" ? styles.tabOn : ""} onClick={openPast}>Past days</button>
          </div>
        </div>

        <div className={styles.body}>
          {tab === "today" && (
            editing ? (
              <>
                <p className={styles.label}>How did today feel?</p>
                <div className={styles.moods}>
                  {MOODS.map((mood) => (
                    <button
                      key={mood.rating}
                      type="button"
                      className={`${styles.mood} ${rating === mood.rating ? styles.moodOn : ""}`}
                      onClick={() => setRating(mood.rating)}
                      aria-pressed={rating === mood.rating}
                    >
                      <span className={styles.moodFace}><Face kind={mood.face} /></span>
                      <small>{mood.label}</small>
                    </button>
                  ))}
                </div>

                <p className={styles.label}>Tell {partnerName} about it</p>
                <textarea
                  className={styles.input}
                  placeholder="What happened today? How are you feeling tonight?"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={5}
                  maxLength={1000}
                />
                <div className={styles.prompts}>
                  {PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => addPrompt(prompt)}>{prompt.trim()}…</button>
                  ))}
                </div>

                {recap?.theyShared && !recap.mine && (
                  <p className={styles.locked}>🔒 {partnerName} already shared their day. Share yours to read it.</p>
                )}
                {error && <p className={styles.error}>{error}</p>}
                <button type="button" className={styles.share} onClick={() => void submit()} disabled={!rating || !text.trim() || saving}>
                  {saving ? <span className={styles.spinner} aria-hidden="true" /> : recap?.mine ? "Update my day" : "Share my day 🌙"}
                </button>
                <p className={styles.note}>Sharing keeps your 🔥 streak going.</p>
              </>
            ) : (
              <>
                <EntryCard who="You" entry={recap?.mine || null} mine />
                {recap?.theirs ? (
                  <EntryCard who={partnerName} entry={recap.theirs} />
                ) : (
                  <div className={styles.waiting}>
                    <span>💭</span>
                    <p>Waiting for {partnerName} to share their day. You&apos;ll get a notification.</p>
                  </div>
                )}
                <button type="button" className={styles.editLink} onClick={() => setEditing(true)}>Edit my day</button>
              </>
            )
          )}

          {tab === "past" && (
            <div className={styles.past}>
              {history === null && <p className={styles.note}>Loading…</p>}
              {history?.length === 0 && <p className={styles.note}>Days you both share will collect here.</p>}
              {history?.map((item) => (
                <section key={item.day} className={styles.pastDay}>
                  <h3>{niceDay(item.day)}</h3>
                  <EntryCard who="You" entry={item.mine} mine />
                  <EntryCard who={partnerName} entry={item.theirs} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
