"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./OnThisDay.module.css";
import { api, mediaUrl } from "@/lib/api";

type Memory = {
  id: string;
  kind: "journal" | "photo" | "answer" | "snap";
  label: string;
  title: string;
  text: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "";
  date: string;
};

const KIND_ICON: Record<Memory["kind"], string> = { journal: "📖", photo: "📸", answer: "💬", snap: "👻" };

export default function OnThisDay() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [open, setOpen] = useState<Memory | null>(null);
  const [broken, setBroken] = useState<string[]>([]);

  useEffect(() => {
    api<Memory[]>(`/api/memories?offset=${new Date().getTimezoneOffset()}`)
      .then((rows) => setMemories(rows.map((row) => ({ ...row, mediaUrl: row.mediaUrl ? mediaUrl(row.mediaUrl) : "" }))))
      .catch(() => setMemories([]));
  }, []);

  if (memories === null) return null;

  const showImage = (memory: Memory) => memory.mediaType === "image" && memory.mediaUrl && !broken.includes(memory.id);

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2>On this day</h2>
        {memories.length > 0 && <span>{memories.length} {memories.length === 1 ? "memory" : "memories"}</span>}
      </div>

      {memories.length === 0 ? (
        <div className={styles.empty}>
          <span>🗓️</span>
          <p>Photos, journal entries and answers from a month or a year ago today will pop up here.</p>
        </div>
      ) : (
        <div className={styles.strip}>
          {memories.map((memory) => (
            <button key={memory.id} type="button" className={styles.card} onClick={() => setOpen(memory)}>
              {showImage(memory) ? (
                <img
                  src={memory.mediaUrl}
                  alt=""
                  className={styles.cover}
                  onError={() => setBroken((ids) => [...ids, memory.id])}
                />
              ) : (
                <div className={`${styles.cover} ${styles.coverText}`}>
                  <span>{KIND_ICON[memory.kind]}</span>
                  <p>{memory.title}</p>
                </div>
              )}
              <div className={styles.shade} />
              <span className={styles.label}>{memory.label}</span>
            </button>
          ))}
        </div>
      )}

      {open && createPortal(
        <div className={styles.viewer} onClick={() => setOpen(null)}>
          <div className={styles.viewerCard} onClick={(event) => event.stopPropagation()}>
            <span className={styles.viewerLabel}>{KIND_ICON[open.kind]} {open.label}</span>
            {showImage(open) && <img src={open.mediaUrl} alt="" className={styles.viewerMedia} />}
            {open.mediaType === "video" && open.mediaUrl && <video src={open.mediaUrl} className={styles.viewerMedia} controls playsInline />}
            {open.mediaType === "audio" && open.mediaUrl && <audio src={open.mediaUrl} controls style={{ width: "100%" }} />}
            <h3 className={styles.viewerTitle}>{open.title}</h3>
            {open.text && <p className={styles.viewerText}>{open.text}</p>}
            <p className={styles.viewerDate}>
              {new Date(open.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            <button type="button" className={styles.viewerClose} onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
