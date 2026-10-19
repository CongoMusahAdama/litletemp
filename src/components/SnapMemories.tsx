"use client";

import { useEffect, useState } from "react";
import styles from "./SnapMemories.module.css";
import { api, mediaUrl } from "@/lib/api";
import ViewOnceIcon from "./ViewOnceIcon";

type SavedSnap = { id: string; mediaUrl: string; sentCount: number; createdAt: string };

interface Props {
  partnerName: string;
  onClose: () => void;
  onSent: () => void;
}

function monthLabel(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function SnapMemories({ partnerName, onClose, onSent }: Props) {
  const [snaps, setSnaps] = useState<SavedSnap[] | null>(null);
  const [open, setOpen] = useState<SavedSnap | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SavedSnap[]>("/api/snaps")
      .then((rows) => setSnaps(rows.map((row) => ({ ...row, mediaUrl: mediaUrl(row.mediaUrl) }))))
      .catch(() => setSnaps([]));
  }, []);

  const groups: { label: string; items: SavedSnap[] }[] = [];
  (snaps || []).forEach((snap) => {
    const label = monthLabel(snap.createdAt);
    const group = groups[groups.length - 1];
    if (group && group.label === label) group.items.push(snap);
    else groups.push({ label, items: [snap] });
  });

  const send = async () => {
    if (!open || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/snaps/${open.id}/send`, { method: "POST", body: JSON.stringify({ viewOnce }) });
      onSent();
    } catch {
      setError("Could not send it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!open || busy) return;
    const id = open.id;
    setOpen(null);
    setSnaps((prev) => (prev || []).filter((snap) => snap.id !== id));
    api(`/api/snaps/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  return (
    <div className={styles.memories}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onClose} aria-label="Back to camera">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h2>Memories</h2>
        <span className={styles.count}>{snaps ? snaps.length : ""}</span>
      </header>

      <div className={styles.body}>
        {snaps === null && <p className={styles.note}>Loading your snaps…</p>}
        {snaps?.length === 0 && (
          <div className={styles.empty}>
            <span>📸</span>
            <p>Snaps you send or save show up here. Send an old one any time to keep your streak 🔥</p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className={styles.month}>{group.label}</h3>
            <div className={styles.grid}>
              {group.items.map((snap) => (
                <button key={snap.id} type="button" className={styles.tile} onClick={() => { setError(""); setViewOnce(false); setOpen(snap); }}>
                  <img src={snap.mediaUrl} alt="" loading="lazy" />
                  {snap.sentCount > 0 && <span className={styles.sent}>Sent</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {open && (
        <div className={styles.viewer}>
          <img src={open.mediaUrl} alt="" className={styles.viewerImg} />
          <div className={styles.viewerTop}>
            <button type="button" className={styles.round} onClick={() => setOpen(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <span className={styles.viewerDate}>
              {new Date(open.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button type="button" className={styles.round} onClick={() => void remove()} aria-label="Delete snap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.viewerBar}>
            <button type="button" className={`${styles.once} ${viewOnce ? styles.onceOn : ""}`} onClick={() => setViewOnce((v) => !v)}>
              <ViewOnceIcon size={18} />
              {viewOnce ? "View once" : "Keep in chat"}
            </button>
            <button type="button" className={styles.send} onClick={() => void send()} disabled={busy}>
              {busy ? "Sending…" : `Send to ${partnerName} 🔥`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
