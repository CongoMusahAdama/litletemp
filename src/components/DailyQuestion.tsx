"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./DailyQuestion.module.css";
import { api } from "@/lib/api";
import type { Daily } from "@/hooks/useDaily";

interface Props {
  daily: Daily | null;
  partnerName: string;
  onAnswer: (text: string) => Promise<Daily>;
  onClose: () => void;
}

function niceDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DailyQuestion({ daily, partnerName, onAnswer, onClose }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"today" | "past">("today");
  const [history, setHistory] = useState<Daily[] | null>(null);

  const submit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onAnswer(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer");
    } finally {
      setSaving(false);
    }
  };

  const openPast = () => {
    setTab("past");
    if (!history) api<Daily[]>("/api/daily/history").then(setHistory).catch(() => setHistory([]));
  };

  // Rendered on <body> so the bottom menu and page layout can never cover it.
  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.grip} />
        <div className={styles.tabs}>
          <button type="button" className={tab === "today" ? styles.tabOn : ""} onClick={() => setTab("today")}>Today</button>
          <button type="button" className={tab === "past" ? styles.tabOn : ""} onClick={openPast}>Past answers</button>
        </div>

        {tab === "today" && (
          !daily ? <p className={styles.muted}>Loading today&apos;s question…</p> : (
            <>
              <p className={styles.kicker}>💬 Question of the day</p>
              <h2 className={styles.question}>{daily.question}</h2>

              {daily.mine === null ? (
                <>
                  {daily.theyAnswered && (
                    <p className={styles.teaser}>🔒 {partnerName} already answered. Answer to see what they said.</p>
                  )}
                  <textarea
                    className={styles.input}
                    placeholder="Type your answer…"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={4}
                    maxLength={600}
                    autoFocus
                  />
                  {error && <p className={styles.error}>{error}</p>}
                  <button type="button" className={styles.submit} onClick={() => void submit()} disabled={!text.trim() || saving}>
                    {saving ? "Saving…" : "Answer"}
                  </button>
                  <p className={styles.muted}>Answering keeps your 🔥 streak going for today.</p>
                </>
              ) : (
                <div className={styles.answers}>
                  <div className={`${styles.answer} ${styles.answerMine}`}>
                    <strong>You</strong>
                    <p>{daily.mine}</p>
                  </div>
                  {daily.theirs !== null ? (
                    <div className={`${styles.answer} ${styles.answerTheirs}`}>
                      <strong>{partnerName}</strong>
                      <p>{daily.theirs}</p>
                    </div>
                  ) : (
                    <div className={`${styles.answer} ${styles.answerWaiting}`}>
                      <strong>{partnerName}</strong>
                      <p>Waiting for their answer… you&apos;ll get a notification.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}

        {tab === "past" && (
          <div className={styles.past}>
            {history === null && <p className={styles.muted}>Loading…</p>}
            {history?.length === 0 && <p className={styles.muted}>Days you both answer will collect here.</p>}
            {history?.map((item) => (
              <div key={item.day} className={styles.pastItem}>
                <span className={styles.pastDay}>{niceDay(item.day)}</span>
                <p className={styles.pastQuestion}>{item.question}</p>
                <p className={styles.pastLine}><strong>You:</strong> {item.mine}</p>
                <p className={styles.pastLine}><strong>{partnerName}:</strong> {item.theirs}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
