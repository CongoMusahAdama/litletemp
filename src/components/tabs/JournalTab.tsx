"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./JournalTab.module.css";
import { api, mediaUrl, uploadFile } from "@/lib/api";

interface Entry {
  id: string;
  title: string;
  color: string;
  textColor: string;
  date: string;
  favorite?: boolean;
  image?: string; // Legacy for initial entries
  media?: { url: string; type: "image" | "video" }[];
}

interface ServerEntry {
  id: string;
  title: string;
  text: string;
  color: string;
  textColor: string;
  date: string;
  favorite: boolean;
  image?: string;
  media?: { url: string; type: "image" | "video" }[];
}

const filters = ["Recent", "Favorites", "Photos", "Voice", "Wishlist"];

interface WishlistItem {
  id: string;
  title: string;
  desc: string;
  emoji: string;
}

interface Props {
  triggerNewEntry?: number;
}

export default function JournalTab({ triggerNewEntry }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeFilter, setActiveFilter] = useState("Recent");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newMedia, setNewMedia] = useState<{ url: string; type: "image" | "video" }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wishlist state
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [newWishTitle, setNewWishTitle] = useState("");
  const [newWishDesc, setNewWishDesc] = useState("");

  useEffect(() => {
    if (triggerNewEntry && triggerNewEntry > 0) {
      setShowNewEntry(true);
    }
  }, [triggerNewEntry]);

  useEffect(() => {
    api<ServerEntry[]>("/api/journal")
      .then((rows) => setEntries(rows.map((row) => ({
        ...row,
        id: String(row.id),
        image: row.image ? mediaUrl(row.image) : undefined,
        media: (row.media || []).map((item) => ({ ...item, url: mediaUrl(item.url) })),
      }))))
      .catch(() => undefined);
    api<WishlistItem[]>("/api/wishlist")
      .then((rows) => setWishlist(rows.map((row) => ({ ...row, id: String(row.id) }))))
      .catch(() => undefined);
  }, []);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const picked = Array.from(files);
    e.target.value = "";
    const uploaded = await Promise.all(picked.map(async (file) => {
      const type = file.type.startsWith("video/") ? "video" as const : "image" as const;
      const saved = await uploadFile(file);
      return { url: saved.url, type };
    }));
    setNewMedia(prev => [...prev, ...uploaded]);
  };

  const removeMedia = (index: number) => {
    setNewMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    const firstMediaUrl = newMedia.length > 0 ? newMedia[0].url : undefined;
    try {
      const saved = await api<ServerEntry>("/api/journal", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          text: newBody,
          color: firstMediaUrl ? "#1a1a1a" : "#FBBF24",
          textColor: firstMediaUrl ? "#ffffff" : "#1a1a1a",
          media: newMedia,
        }),
      });
      setEntries([{
        ...saved,
        id: String(saved.id),
        image: saved.image ? mediaUrl(saved.image) : undefined,
        media: (saved.media || []).map((item) => ({ ...item, url: mediaUrl(item.url) })),
      }, ...entries]);
      setNewTitle("");
      setNewBody("");
      setNewMedia([]);
      setShowNewEntry(false);
    } catch {
      // Keep the draft open so it can be saved again.
    }
  };

  const handleAddWish = async () => {
    if (!newWishTitle.trim()) return;
    try {
      const item = await api<WishlistItem>("/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ title: newWishTitle, desc: newWishDesc }),
      });
      setWishlist([{ ...item, id: String(item.id) }, ...wishlist]);
      setNewWishTitle("");
      setNewWishDesc("");
    } catch {
      // Keep the typed wish so it can be retried.
    }
  };

  const isPhotosView = activeFilter === "Photos";
  const isWishlistView = activeFilter === "Wishlist";
  const visibleEntries = activeFilter === "Favorites" ? entries.filter(entry => entry.favorite) : entries;
  const allPhotoEntries = entries.filter(e => e.image);

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
              rows={5}
            />
            <div className={styles.photoUploadRow}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className={styles.photoUploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Add Media</span>
              </button>
            </div>
            
            {newMedia.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0 16px', margin: '0 24px', scrollbarWidth: 'none' }}>
                {newMedia.map((m, idx) => (
                  <div key={idx} className={styles.photoPreview} style={{ margin: 0, flexShrink: 0, width: '100px', height: '100px' }}>
                    {m.type === "image" ? (
                      <img src={mediaUrl(m.url)} alt={`Media ${idx}`} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    ) : (
                      <video src={mediaUrl(m.url)} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    )}
                    <button
                      className={styles.photoRemove}
                      onClick={() => removeMedia(idx)}
                      style={{ top: '4px', right: '4px', width: '24px', height: '24px' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px' }}>
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                    {m.type === "video" && (
                      <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '4px', color: '#fff' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '12px', height: '12px' }}>
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
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
        {isWishlistView ? (
          <div className={styles.wishlistContainer}>
            <div className={styles.wishlistAddCard}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#1a1a1a' }}>Add to Wishlist</h3>
              <div className={styles.wishlistInputRow}>
                <input 
                  className={styles.wishlistInput} 
                  placeholder="What do you wish for?"
                  value={newWishTitle}
                  onChange={e => setNewWishTitle(e.target.value)}
                />
                <input 
                  className={styles.wishlistInput} 
                  placeholder="Details (optional)"
                  value={newWishDesc}
                  onChange={e => setNewWishDesc(e.target.value)}
                />
                <button className={styles.wishlistSubmit} onClick={handleAddWish}>Add Wish</button>
              </div>
            </div>

            {wishlist.map(item => (
              <div key={item.id} className={styles.wishlistItem}>
                <div className={styles.wishlistContent}>
                  <h4 className={styles.wishlistTitle}>{item.title}</h4>
                  {item.desc && <p className={styles.wishlistDesc}>{item.desc}</p>}
                </div>
                <div className={styles.wishlistImage}>
                  {item.emoji}
                </div>
              </div>
            ))}
          </div>
        ) : isPhotosView ? (
          <div className={styles.photoGrid}>
            {allPhotoEntries.map((entry, idx) => (
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
            {visibleEntries.map(entry => (
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
                
                {/* Video Play Icon overlay if the first media is a video */}
                {entry.media && entry.media.length > 0 && entry.media[0].type === "video" && (
                   <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                     <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px', marginLeft: '4px' }}>
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                     </div>
                   </div>
                )}

                <div className={styles.cardHeader} style={{ position: 'relative', zIndex: 2 }}>
                  <div className={styles.cardDate} style={{
                    color: entry.image ? "#fff" : entry.textColor,
                    borderColor: entry.image ? "rgba(255,255,255,0.5)" : entry.textColor,
                  }}>
                    {entry.date}
                  </div>
                </div>
                <h3 className={styles.cardTitle} style={{ color: entry.image ? "#fff" : entry.textColor, position: 'relative', zIndex: 2 }}>
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
