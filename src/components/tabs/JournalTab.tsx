"use client";

import { useState } from "react";
import styles from "./JournalTab.module.css";

interface Entry {
  id: number;
  title: string;
  color: string;
  textColor: string;
  date: string;
  image?: string;
}

const initialEntries: Entry[] = [
  { id: 1, title: "Our First Date memories", color: "#FBBF24", textColor: "#1a1a1a", date: "Sep 20", image: "/journal_couple.jpg" },
  { id: 2, title: "Why I fall more in love", color: "#F97316", textColor: "#ffffff", date: "Sep 15", image: "/journal_coffee.jpg" },
  { id: 3, title: "Missing you today", color: "#1a1a1a", textColor: "#FBBF24", date: "Sep 10", image: "/journal_night.jpg" },
  { id: 4, title: "Our future travel plans", color: "#ffffff", textColor: "#1a1a1a", date: "Sep 02" },
  { id: 5, title: "Little things you do", color: "#FBBF24", textColor: "#1a1a1a", date: "Aug 28", image: "/journal_couple.jpg" },
  { id: 6, title: "Random midnight thoughts", color: "#1a1a1a", textColor: "#ffffff", date: "Aug 21", image: "/journal_night.jpg" },
];

const filters = ["Recent", "Favorites", "Photos", "Voice"];

// Photo grid images (using entries with images + some extras)
const photoEntries = initialEntries.filter(e => e.image);

export default function JournalTab() {
  const [entries, setEntries] = useState(initialEntries);
  const [activeFilter, setActiveFilter] = useState("Recent");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const handleSave = () => {
    if (!newTitle.trim()) return;
    const next: Entry = {
      id: Date.now(),
      title: newTitle,
      color: "#FBBF24",
      textColor: "#1a1a1a",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    setEntries([next, ...entries]);
    setNewTitle("");
    setNewBody("");
    setShowNewEntry(false);
  };

  const isPhotosView = activeFilter === "Photos";

  return (
    <div className={styles.tab}>

      {/* New Entry Modal */}
      {showNewEntry && (
        <div className={styles.modalOverlay} onClick={() => setShowNewEntry(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Entry</h2>
              <button className={styles.modalClose} onClick={() => setShowNewEntry(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              className={styles.modalTitleInput}
              placeholder="Give it a title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className={styles.modalBody}
              placeholder="Write something sweet for your love..."
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={6}
            />
            <button className={styles.modalSave} onClick={handleSave}>
              Save Entry
            </button>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Love Journal</h1>
        <button className={styles.iconBtn} onClick={() => setShowNewEntry(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </header>

      {/* Pill Filters */}
      <div className={styles.filtersWrapper}>
        <div className={styles.filtersScroll}>
          {filters.map(f => (
            <button
              key={f}
              className={`${styles.filterPill} ${activeFilter === f ? styles.filterActive : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.contentScroll}>
        {isPhotosView ? (
          <div className={styles.photoGrid}>
            {photoEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className={styles.photoItem}
                style={{
                  backgroundImage: `url(${entry.image})`,
                  gridRow: idx === 0 ? "span 2" : "auto",
                  gridColumn: idx === 2 ? "span 2" : "auto",
                }}
              >
                <div className={styles.photoOverlay}>
                  <span className={styles.photoDate}>{entry.date}</span>
                  <h4 className={styles.photoTitle}>{entry.title}</h4>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>

            {/* Hero Card */}
            <div className={styles.heroCard} onClick={() => setShowNewEntry(true)}>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>Write something sweet to your love</h2>
                <button className={styles.heroBtn}>
                  <span className={styles.heroBtnIcon}>+</span>
                  New Entry
                </button>
              </div>
              <div className={styles.heroDeco}>
                <div className={styles.heroCircle} />
              </div>
            </div>

            {/* Note Cards */}
            {entries.map(entry => (
              <div
                key={entry.id}
                className={styles.card}
                style={{
                  backgroundColor: entry.color,
                  color: entry.textColor,
                  border: entry.color === "#ffffff" ? "1px solid #e5e7eb" : "none",
                  backgroundImage: entry.image ? `url(${entry.image})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Dark overlay when there's an image */}
                {entry.image && <div className={styles.cardOverlay} />}
                <div className={styles.cardHeader}>
                  <div className={styles.cardDate} style={{
                    color: entry.image ? "#fff" : entry.textColor,
                    borderColor: entry.image ? "rgba(255,255,255,0.5)" : entry.textColor,
                  }}>
                    {entry.date}
                  </div>
                </div>
                <h3 className={styles.cardTitle} style={{ color: entry.image ? "#fff" : entry.textColor }}>
                  {entry.title}
                </h3>
              </div>
            ))}

          </div>
        )}
        <div style={{ height: 100 }} />
      </div>
    </div>
  );
}
