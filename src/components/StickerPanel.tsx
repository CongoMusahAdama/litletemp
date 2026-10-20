"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StickerPanel.module.css";
import { api, mediaUrl } from "@/lib/api";
import { LOVE_PACK, readClipboardImage, saveStickerFile, type SavedSticker } from "@/lib/stickers";

interface Props {
  onSend: (sticker: { mediaUrl?: string; emoji?: string }) => void;
  onClose: () => void;
}

export default function StickerPanel({ onSend, onClose }: Props) {
  const [tab, setTab] = useState<"saved" | "love">("saved");
  const [stickers, setStickers] = useState<SavedSticker[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<SavedSticker[]>("/api/stickers")
      .then((rows) => {
        setStickers(rows);
        if (!rows.length) setTab("love");
      })
      .catch(() => setStickers([]));
  }, []);

  const add = async (file: Blob) => {
    setBusy(true);
    setNote("");
    try {
      const saved = await saveStickerFile(file);
      setStickers((prev) => [saved, ...(prev || []).filter((item) => item.id !== saved.id)]);
      setTab("saved");
      setNote("Sticker saved ⭐");
    } catch {
      setNote("Could not save that sticker");
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const image = await readClipboardImage();
      if (image) await add(image);
      else setNote("No sticker or image copied. Copy one first, then tap Paste.");
    } catch {
      setNote("Your browser blocked pasting. Long-press the message box and choose Paste instead.");
    }
  };

  const remove = (sticker: SavedSticker) => {
    setStickers((prev) => (prev || []).filter((item) => item.id !== sticker.id));
    api(`/api/stickers/${sticker.id}`, { method: "DELETE" }).catch(() => undefined);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div className={styles.tabs}>
          <button type="button" className={tab === "saved" ? styles.tabOn : ""} onClick={() => setTab("saved")}>⭐ Saved</button>
          <button type="button" className={tab === "love" ? styles.tabOn : ""} onClick={() => setTab("love")}>💗 Love pack</button>
        </div>
        {tab === "saved" && !!stickers?.length && (
          <button type="button" className={styles.edit} onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit"}</button>
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close stickers">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {note && <p className={styles.note}>{note}</p>}

      <div className={styles.grid}>
        {tab === "saved" ? (
          <>
            <button type="button" className={styles.action} onClick={() => void paste()} disabled={busy}>
              <span>📋</span>
              <small>Paste</small>
            </button>
            <button type="button" className={styles.action} onClick={() => fileRef.current?.click()} disabled={busy}>
              <span>{busy ? <i className={styles.spinner} /> : "＋"}</span>
              <small>{busy ? "Saving" : "Add"}</small>
            </button>
            {stickers === null && Array.from({ length: 6 }, (_, i) => <span key={i} className={styles.placeholder} />)}
            {stickers?.map((sticker) => (
              <div key={sticker.id} className={styles.cell}>
                <button type="button" className={styles.sticker} onClick={() => !editing && onSend({ mediaUrl: sticker.mediaUrl })} aria-label="Send sticker">
                  <img src={mediaUrl(sticker.mediaUrl)} alt="" loading="lazy" />
                </button>
                {editing && (
                  <button type="button" className={styles.remove} onClick={() => remove(sticker)} aria-label="Remove sticker">×</button>
                )}
              </div>
            ))}
          </>
        ) : (
          LOVE_PACK.map((emoji) => (
            <button key={emoji} type="button" className={`${styles.sticker} ${styles.emojiSticker}`} onClick={() => onSend({ emoji })} aria-label={`Send ${emoji}`}>
              {emoji}
            </button>
          ))
        )}
      </div>

      {tab === "saved" && stickers?.length === 0 && (
        <p className={styles.hint}>Copy a sticker (for example in WhatsApp), then tap <b>Paste</b>. Or tap <b>＋</b> to make one from a photo.</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp,image/gif,image/jpeg"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void add(file);
        }}
      />
    </div>
  );
}
