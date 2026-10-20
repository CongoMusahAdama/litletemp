"use client";

import { useState, useRef, useEffect } from "react";
import { scopedSocket } from "@/lib/socket";
import styles from "./JournalTab.module.css";
import VoicePlayer from "../VoicePlayer";
import { api, mediaUrl, uploadFile } from "@/lib/api";

interface Entry {
  id: string;
  title: string;
  text: string;
  color: string;
  textColor: string;
  date: string;
  favorite?: boolean;
  image?: string;
  media?: { url: string; type: "image" | "video" | "audio" }[];
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
  media?: { url: string; type: "image" | "video" | "audio" }[];
}

const filters = ["Recent", "Favorites", "Photos", "Voice", "Wishlist"];

interface WishlistItem {
  id: string;
  title: string;
  desc: string;
  emoji: string;
  images: string[];
}

interface Props {
  triggerNewEntry?: number;
}

function formatWish(row: WishlistItem): WishlistItem {
  return { ...row, id: String(row.id), images: (row.images || []).map(mediaUrl) };
}

async function uploadImages(files: FileList | null) {
  const picked = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  const saved = await Promise.all(picked.map((file) => uploadFile(file)));
  return saved.map((item) => item.url);
}

function formatEntry(row: ServerEntry): Entry {
  const media = (row.media || []).map((item) => ({ ...item, url: mediaUrl(item.url) }));
  const image = media.find((item) => item.type === "image")?.url || (row.image ? mediaUrl(row.image) : undefined);
  return { ...row, id: String(row.id), image, media };
}

export default function JournalTab({ triggerNewEntry }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeFilter, setActiveFilter] = useState("Recent");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newMedia, setNewMedia] = useState<{ url: string; type: "image" | "video" | "audio" }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recRef = useRef<{ stream: MediaStream; ctx: AudioContext; processor: ScriptProcessorNode; chunks: Float32Array[]; started: number } | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Wishlist state
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [newWishTitle, setNewWishTitle] = useState("");
  const [newWishDesc, setNewWishDesc] = useState("");
  const [newWishImages, setNewWishImages] = useState<string[]>([]);
  const [wishUploading, setWishUploading] = useState(false);
  const wishFileRef = useRef<HTMLInputElement>(null);
  const wishMoreRef = useRef<HTMLInputElement>(null);

  // Detail views
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [openWishId, setOpenWishId] = useState<string | null>(null);
  const openEntry = entries.find((entry) => entry.id === openEntryId) || null;
  const openWish = wishlist.find((item) => item.id === openWishId) || null;

  useEffect(() => {
    if (triggerNewEntry && triggerNewEntry > 0) {
      setShowNewEntry(true);
    }
  }, [triggerNewEntry]);

  useEffect(() => {
    api<ServerEntry[]>("/api/journal")
      .then((rows) => setEntries(rows.map(formatEntry)))
      .catch(() => undefined);
    api<WishlistItem[]>("/api/wishlist")
      .then((rows) => setWishlist(rows.map(formatWish)))
      .catch(() => undefined);

    const socket = scopedSocket();
    socket.on("journal:new", (row: ServerEntry) => {
      const formatted = formatEntry(row);
      setEntries((prev) => [formatted, ...prev.filter((e) => e.id !== formatted.id)]);
    });
    socket.on("journal:updated", (row: ServerEntry) => {
      const formatted = formatEntry(row);
      setEntries((prev) => prev.map((entry) => entry.id === formatted.id ? formatted : entry));
    });
    socket.on("wishlist:new", (item: WishlistItem) => {
      setWishlist((prev) => [formatWish(item), ...prev.filter((w) => w.id !== String(item.id))]);
    });
    socket.on("wishlist:updated", (item: WishlistItem) => {
      const formatted = formatWish(item);
      setWishlist((prev) => prev.map((w) => w.id === formatted.id ? formatted : w));
    });
    socket.on("journal:deleted", ({ id }: { id: string }) => {
      setEntries((prev) => prev.filter((e) => e.id !== String(id)));
    });
    socket.on("wishlist:deleted", ({ id }: { id: string }) => {
      setWishlist((prev) => prev.filter((w) => w.id !== String(id)));
    });

    return () => {
      socket.disconnect();
    };
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
          color: firstMediaUrl ? "#1a1a1a" : "#FF4081",
          textColor: firstMediaUrl ? "#ffffff" : "#1a1a1a",
          media: newMedia,
        }),
      });
      setEntries((prev) => [formatEntry(saved), ...prev]);
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
        body: JSON.stringify({ title: newWishTitle, desc: newWishDesc, images: newWishImages }),
      });
      const formatted = formatWish(item);
      setWishlist((prev) => [formatted, ...prev.filter((w) => w.id !== formatted.id)]);
      setNewWishTitle("");
      setNewWishDesc("");
      setNewWishImages([]);
    } catch {
      // Keep the typed wish so it can be retried.
    }
  };

  const pickWishImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setWishUploading(true);
    try {
      const urls = await uploadImages(files);
      setNewWishImages((prev) => [...prev, ...urls].slice(0, 8));
    } catch {
      // Upload failed; the wish can still be saved without it.
    } finally {
      e.target.value = "";
      setWishUploading(false);
    }
  };

  const saveWishImages = async (wish: WishlistItem, images: string[]) => {
    const saved = await api<WishlistItem>(`/api/wishlist/${wish.id}`, {
      method: "PATCH",
      body: JSON.stringify({ images }),
    }).catch(() => null);
    if (!saved) return;
    const formatted = formatWish(saved);
    setWishlist((prev) => prev.map((w) => w.id === formatted.id ? formatted : w));
  };

  const addImagesToWish = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!openWish) return;
    const wish = openWish;
    const files = e.target.files;
    setWishUploading(true);
    try {
      const urls = await uploadImages(files);
      if (urls.length) await saveWishImages(wish, [...wish.images, ...urls].slice(0, 8));
    } catch {
      // Leave the wish as it was.
    } finally {
      e.target.value = "";
      setWishUploading(false);
    }
  };

  const deleteWish = async (wish: WishlistItem) => {
    const ok = await api(`/api/wishlist/${wish.id}`, { method: "DELETE" }).then(() => true).catch(() => false);
    if (!ok) return;
    setWishlist((prev) => prev.filter((w) => w.id !== wish.id));
    setOpenWishId(null);
  };

  const toggleFavorite = async (entry: Entry) => {
    const saved = await api<ServerEntry>(`/api/journal/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ favorite: !entry.favorite }),
    }).catch(() => null);
    if (!saved) return;
    const next = formatEntry(saved);
    setEntries((prev) => prev.map((item) => item.id === next.id ? next : item));
  };

  const stopRecording = async (save: boolean) => {
    const rec = recRef.current;
    recRef.current = null;
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    if (!rec) return;
    rec.processor.disconnect();
    rec.stream.getTracks().forEach((track) => track.stop());
    const sampleRate = rec.ctx.sampleRate;
    await rec.ctx.close();
    if (!save || rec.chunks.length === 0) return;
    const file = new File([encodeWav(rec.chunks, sampleRate)], "voice.wav", { type: "audio/wav" });
    const uploaded = await uploadFile(file);
    const saved = await api<ServerEntry>("/api/journal", {
      method: "POST",
      body: JSON.stringify({
        title: "Voice note",
        text: "",
        media: [{ url: uploaded.url, type: "audio" }],
      }),
    });
    setEntries((prev) => [formatEntry(saved), ...prev]);
  };

  const startRecording = async () => {
    if (recRef.current) return;
    const ctx = new AudioContext();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      recRef.current = { stream, ctx, processor, chunks, started: Date.now() };
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        const current = recRef.current;
        if (current) setRecordingTime(Math.floor((Date.now() - current.started) / 1000));
      }, 250);
    } catch {
      await ctx.close();
      setIsRecording(false);
    }
  };

  const isPhotosView = activeFilter === "Photos";
  const isVoiceView = activeFilter === "Voice";
  const isWishlistView = activeFilter === "Wishlist";
  const visibleEntries = activeFilter === "Favorites" ? entries.filter(entry => entry.favorite) : entries;
  const allPhotoEntries = entries.filter(e => e.media?.some(item => item.type === "image") || e.image);
  const voiceEntries = entries.filter(e => e.media?.some(item => item.type === "audio"));

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

      {/* Journal Entry Detail */}
      {openEntry && (
        <div className={styles.modalOverlay} onClick={() => setOpenEntryId(null)}>
          <div className={`${styles.modal} ${styles.detailModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.detailDate}>{openEntry.date}</span>
              <div className={styles.detailActions}>
                <button type="button" className={styles.detailHeart} onClick={() => void toggleFavorite(openEntry)} aria-label="Save memory">
                  {openEntry.favorite ? "♥" : "♡"}
                </button>
                <button className={styles.modalClose} onClick={() => setOpenEntryId(null)} aria-label="Close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <h2 className={styles.detailTitle}>{openEntry.title}</h2>
            {openEntry.text
              ? <p className={styles.detailText}>{openEntry.text}</p>
              : !openEntry.media?.length && <p className={styles.emptyNote}>No words in this one, just the title.</p>}
            {!!openEntry.media?.length && (
              <div className={styles.detailMedia}>
                {openEntry.media.map((m, idx) => (
                  m.type === "image" ? <img key={idx} src={m.url} alt="" />
                  : m.type === "video" ? <video key={idx} src={m.url} controls playsInline />
                  : <VoicePlayer key={idx} src={m.url} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wishlist Detail */}
      {openWish && (
        <div className={styles.modalOverlay} onClick={() => setOpenWishId(null)}>
          <div className={`${styles.modal} ${styles.detailModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.detailEmoji}>{openWish.emoji}</span>
              <button className={styles.modalClose} onClick={() => setOpenWishId(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
              </button>
            </div>
            <h2 className={styles.detailTitle}>{openWish.title}</h2>
            {openWish.desc
              ? <p className={styles.detailText}>{openWish.desc}</p>
              : <p className={styles.emptyNote}>No details yet.</p>}
            {openWish.images.length > 0 && (
              <div className={styles.detailMedia}>
                {openWish.images.map((url, idx) => (
                  <div key={url} className={styles.detailImageWrap}>
                    <img src={url} alt="" />
                    <button
                      type="button"
                      className={styles.detailImageRemove}
                      onClick={() => void saveWishImages(openWish, openWish.images.filter((_, i) => i !== idx))}
                      aria-label="Remove photo"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={wishMoreRef} type="file" accept="image/*" multiple onChange={addImagesToWish} style={{ display: "none" }} />
            <div className={styles.detailFooter}>
              <button
                type="button"
                className={styles.photoUploadBtn}
                onClick={() => wishMoreRef.current?.click()}
                disabled={wishUploading || openWish.images.length >= 8}
              >
                {wishUploading ? "Uploading..." : "Add photos"}
              </button>
              <button type="button" className={styles.detailDelete} onClick={() => void deleteWish(openWish)}>
                Remove wish
              </button>
            </div>
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Add to Wishlist</h3>
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
                <input ref={wishFileRef} type="file" accept="image/*" multiple onChange={pickWishImages} style={{ display: "none" }} />
                <div className={styles.wishImagesRow}>
                  {newWishImages.map((url, idx) => (
                    <div key={url} className={styles.photoPreview}>
                      <img src={mediaUrl(url)} alt="" />
                      <button
                        type="button"
                        className={styles.photoRemove}
                        onClick={() => setNewWishImages((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove photo"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                      </button>
                    </div>
                  ))}
                  {newWishImages.length < 8 && (
                    <button type="button" className={styles.wishAddPhoto} onClick={() => wishFileRef.current?.click()} disabled={wishUploading}>
                      {wishUploading ? "Uploading..." : "+ Add photos"}
                    </button>
                  )}
                </div>
                <button className={styles.wishlistSubmit} onClick={handleAddWish} disabled={wishUploading}>Add Wish</button>
              </div>
            </div>

            {wishlist.map(item => (
              <button type="button" key={item.id} className={styles.wishlistItem} onClick={() => setOpenWishId(item.id)}>
                <div className={styles.wishlistContent}>
                  <h4 className={styles.wishlistTitle}>{item.title}</h4>
                  {item.desc && <p className={styles.wishlistDesc}>{item.desc}</p>}
                  {item.images.length > 1 && <span className={styles.wishlistCount}>{item.images.length} photos</span>}
                </div>
                <div className={styles.wishlistImage}>
                  {item.images[0] ? <img src={item.images[0]} alt="" /> : item.emoji}
                </div>
              </button>
            ))}
          </div>
        ) : isPhotosView ? (
          <div className={styles.photoGrid}>
            {allPhotoEntries.length === 0 && <p className={styles.emptyNote}>No photos yet. Add one from a new journal entry.</p>}
            {allPhotoEntries.map((entry) => (
              <div key={entry.id} className={styles.photoItem} onClick={() => setOpenEntryId(entry.id)}>
                <img src={entry.image} alt={entry.title} />
                <div className={styles.photoOverlay}>
                  <span className={styles.photoDate}>{entry.date}</span>
                  <h4 className={styles.photoTitle}>{entry.title}</h4>
                </div>
              </div>
            ))}
          </div>
        ) : isVoiceView ? (
          <div className={styles.grid}>
            <div className={styles.heroCard}>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>{isRecording ? `Recording ${recordingTime}s` : "Record a voice note"}</h2>
                <button className={styles.heroBtn} onClick={() => isRecording ? void stopRecording(true) : void startRecording()}>
                  {isRecording ? "Save voice note" : "Start recording"}
                </button>
                {isRecording && <button className={styles.heroBtn} onClick={() => void stopRecording(false)}>Cancel</button>}
              </div>
            </div>
            {voiceEntries.length === 0 && <p className={styles.emptyNote}>No voice notes yet.</p>}
            {voiceEntries.map((entry) => {
              const audio = entry.media?.find((item) => item.type === "audio");
              return (
                <div key={entry.id} className={styles.card} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <h3 className={styles.cardTitle} onClick={() => setOpenEntryId(entry.id)}>{entry.title}</h3>
                  {audio && <div style={{ marginTop: 12 }}><VoicePlayer src={audio.url} /></div>}
                </div>
              );
            })}
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
                onClick={() => setOpenEntryId(entry.id)}
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
                  <button type="button" className={styles.heartBtn} onClick={(e) => { e.stopPropagation(); void toggleFavorite(entry); }} aria-label="Save memory">
                    {entry.favorite ? "♥" : "♡"}
                  </button>
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

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  });
  return new Blob([buffer], { type: "audio/wav" });
}
