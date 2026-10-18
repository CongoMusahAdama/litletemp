"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SnapCamera.module.css";

interface Props {
  onClose: () => void;
  onSend: (file: File, viewOnce: boolean) => Promise<void>;
}

type Op = ["saturate" | "sepia" | "grayscale" | "brightness" | "contrast" | "hue", number];

type SnapFilter = {
  id: string;
  name: string;
  swatch: string;
  ops: Op[];
  tint?: string;
  stickers?: { emoji: string; x: number; y: number; size: number }[];
};

const FILTERS: SnapFilter[] = [
  { id: "normal", name: "Normal", swatch: "linear-gradient(135deg,#f5f5f5,#d4d4d4)", ops: [] },
  { id: "warm", name: "Warm", swatch: "linear-gradient(135deg,#FDE68A,#F59E0B)", ops: [["sepia", 0.25], ["saturate", 1.3], ["brightness", 1.05]] },
  { id: "golden", name: "Golden", swatch: "linear-gradient(135deg,#FCD34D,#EA580C)", ops: [["sepia", 0.35], ["saturate", 1.4], ["contrast", 1.05]], tint: "rgba(255,190,80,0.12)" },
  { id: "love", name: "Love", swatch: "linear-gradient(135deg,#FBCFE8,#F43F5E)", ops: [["saturate", 1.25], ["brightness", 1.04]], tint: "rgba(255,90,140,0.14)",
    stickers: [{ emoji: "❤️", x: 0.12, y: 0.12, size: 0.11 }, { emoji: "💕", x: 0.84, y: 0.2, size: 0.09 }, { emoji: "💖", x: 0.8, y: 0.86, size: 0.1 }] },
  { id: "dreamy", name: "Dreamy", swatch: "linear-gradient(135deg,#E9D5FF,#F9A8D4)", ops: [["brightness", 1.12], ["saturate", 1.2], ["contrast", 0.9]], tint: "rgba(255,170,220,0.15)" },
  { id: "cool", name: "Cool", swatch: "linear-gradient(135deg,#BAE6FD,#3B82F6)", ops: [["saturate", 1.1], ["hue", -15], ["brightness", 1.05]], tint: "rgba(80,140,255,0.1)" },
  { id: "vintage", name: "Vintage", swatch: "linear-gradient(135deg,#E7D3B0,#92400E)", ops: [["sepia", 0.6], ["contrast", 1.1], ["brightness", 0.95], ["saturate", 0.8]] },
  { id: "bw", name: "B&W", swatch: "linear-gradient(135deg,#ffffff,#111111)", ops: [["grayscale", 1], ["contrast", 1.2]] },
  { id: "noir", name: "Noir", swatch: "linear-gradient(135deg,#6b7280,#000000)", ops: [["grayscale", 1], ["contrast", 1.5], ["brightness", 0.9]] },
];

function cssFilter(ops: Op[]) {
  if (!ops.length) return "none";
  return ops.map(([name, value]) => name === "hue" ? `hue-rotate(${value}deg)` : `${name}(${value})`).join(" ");
}

// Same maths as the CSS filter functions, so the sent photo matches the live preview
// (canvas ctx.filter is missing on iPhone Safari).
function opMatrix([name, v]: Op): number[] {
  if (name === "brightness") return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
  if (name === "contrast") {
    const off = (0.5 - 0.5 * v) * 255;
    return [v, 0, 0, off, 0, v, 0, off, 0, 0, v, off];
  }
  if (name === "saturate") {
    return [
      0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0,
    ];
  }
  if (name === "sepia") {
    const a = 1 - v;
    return [
      0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
      0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
      0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0,
    ];
  }
  if (name === "grayscale") {
    const a = 1 - v;
    return [
      0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0,
      0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0,
      0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0,
    ];
  }
  const rad = (v * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
  ];
}

function composeOps(ops: Op[]) {
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  ops.forEach((op) => {
    const o = opMatrix(op);
    const next: number[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        let value = 0;
        for (let k = 0; k < 3; k += 1) value += o[row * 4 + k] * m[k * 4 + col];
        if (col === 3) value += o[row * 4 + 3];
        next.push(value);
      }
    }
    m = next;
  });
  return m;
}

function applyOps(ctx: CanvasRenderingContext2D, width: number, height: number, ops: Op[]) {
  if (!ops.length) return;
  const m = composeOps(ops);
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
    d[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
    d[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
  }
  ctx.putImageData(image, 0, 0);
}

export default function SnapCamera({ onClose, onSend }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const swipeX = useRef<number | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [filterIndex, setFilterIndex] = useState(0);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [viewOnce, setViewOnce] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const filter = FILTERS[filterIndex];

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => setError("Camera is blocked. Allow camera access in your browser settings, then try again."));
    return () => {
      cancelled = true;
    };
  }, [facing, shot, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !video.videoWidth) return;
    // Crop to what the viewfinder shows (object-fit: cover).
    const aspect = stage.clientWidth / stage.clientHeight;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (sw / sh > aspect) sw = sh * aspect;
    else sh = sw / aspect;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    applyOps(ctx, canvas.width, canvas.height, filter.ops);
    if (filter.tint) {
      ctx.fillStyle = filter.tint;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    filter.stickers?.forEach((sticker) => {
      const size = sticker.size * canvas.width;
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sticker.emoji, sticker.x * canvas.width, sticker.y * canvas.height);
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopStream();
      setShot({ file, url: URL.createObjectURL(blob) });
    }, "image/jpeg", 0.9);
  };

  const send = async () => {
    if (!shot || sending) return;
    setSending(true);
    try {
      await onSend(shot.file, viewOnce);
      onClose();
    } catch {
      setError("Could not send the snap. Try again.");
    } finally {
      setSending(false);
    }
  };

  const shiftFilter = (step: number) => {
    setFilterIndex((current) => (current + step + FILTERS.length) % FILTERS.length);
  };

  return (
    <div className={styles.camera}>
      <div
        ref={stageRef}
        className={styles.stage}
        onTouchStart={(event) => { swipeX.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (swipeX.current === null || shot) return;
          const dx = event.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (Math.abs(dx) > 50) shiftFilter(dx < 0 ? 1 : -1);
        }}
      >
        {shot ? (
          <img src={shot.url} alt="Your snap" className={styles.feed} />
        ) : (
          <>
            <video
              ref={videoRef}
              className={`${styles.feed} ${facing === "user" ? styles.mirror : ""}`}
              style={{ filter: cssFilter(filter.ops) }}
              autoPlay
              playsInline
              muted
            />
            {filter.tint && <div className={styles.tint} style={{ background: filter.tint }} />}
            {filter.stickers?.map((sticker) => (
              <span
                key={sticker.emoji}
                className={styles.sticker}
                style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, fontSize: `${sticker.size * 100}cqw` }}
              >
                {sticker.emoji}
              </span>
            ))}
            <div key={filter.id} className={styles.filterName}>{filter.name}</div>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.topBar}>
          <button type="button" className={styles.round} onClick={() => { stopStream(); onClose(); }} aria-label="Close camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {!shot && (
            <button type="button" className={styles.round} onClick={() => { setError(""); setFacing((f) => f === "user" ? "environment" : "user"); }} aria-label="Flip camera">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
                <path d="M9 13.5a3 3 0 0 1 5.2-2" /><polyline points="14.5 9.5 14.5 11.6 12.4 11.6" />
                <path d="M15 12.5a3 3 0 0 1-5.2 2" /><polyline points="9.5 16.5 9.5 14.4 11.6 14.4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {shot ? (
        <div className={styles.reviewBar}>
          <button type="button" className={styles.retake} onClick={() => { setError(""); setShot(null); }}>Retake</button>
          <button type="button" className={`${styles.onceToggle} ${viewOnce ? styles.onceOn : ""}`} onClick={() => setViewOnce((v) => !v)}>
            👁️ {viewOnce ? "View once" : "Keep in chat"}
          </button>
          <button type="button" className={styles.sendSnap} onClick={() => void send()} disabled={sending}>
            {sending ? "Sending..." : "Send"}
            {!sending && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>}
          </button>
        </div>
      ) : (
        <div className={styles.controls}>
          <div className={styles.filterStrip}>
            {FILTERS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.filterChip} ${index === filterIndex ? styles.filterChipOn : ""}`}
                onClick={() => setFilterIndex(index)}
                aria-label={`${item.name} filter`}
              >
                <span style={{ background: item.swatch }}>{item.stickers?.[0]?.emoji}</span>
                <small>{item.name}</small>
              </button>
            ))}
          </div>
          <button type="button" className={styles.shutter} onClick={capture} disabled={!!error} aria-label="Take snap">
            <span />
          </button>
        </div>
      )}
    </div>
  );
}
