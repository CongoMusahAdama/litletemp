"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import styles from "./SnapCamera.module.css";
import { api, uploadFile } from "@/lib/api";
import { unlockDay } from "@/lib/rewards";
import { LENSES, buildFace, type Point } from "@/lib/lenses";
import { FILTERS, cssFilter, labelText, paintFilter, type SnapFilter } from "@/lib/snapFilters";
import SnapMemories from "./SnapMemories";

interface Props {
  onClose: () => void;
  onSent: () => void;
  bestStreak: number;
  partnerName: string;
}

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const LENS_STEP = 74; // lens button width + gap, keep in sync with the CSS

type Shot = { url: string; width: number; height: number; at: Date };

export default function SnapCamera({ onClose, onSent, bestStreak, partnerName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const lensRef = useRef(LENSES[0]);
  const facingRef = useRef<"user" | "environment">("user");
  const swipeX = useRef<number | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [lensIndex, setLensIndex] = useState(0);
  const [lensState, setLensState] = useState<"loading" | "ready" | "failed">("loading");
  const [shot, setShot] = useState<Shot | null>(null);
  const [filterIndex, setFilterIndex] = useState(0);
  const [viewOnce, setViewOnce] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [saved, setSaved] = useState<{ id: string; filter: number } | null>(null);
  const [hint, setHint] = useState<{ text: string; at: number } | null>(null);
  const [error, setError] = useState("");
  const [showMemories, setShowMemories] = useState(false);

  const lens = LENSES[lensIndex];
  const filter = FILTERS[filterIndex];
  const needsFor = (item: SnapFilter) => unlockDay("filter", item.id);
  const isLocked = (item: SnapFilter) => needsFor(item) > bestStreak;

  useEffect(() => { lensRef.current = lens; }, [lens]);
  useEffect(() => { facingRef.current = facing; }, [facing]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Face tracker for lenses. Loaded once; the camera works without it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const options = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO" as const,
          numFaces: 2,
        });
        let tracker: FaceLandmarker;
        try {
          tracker = await vision.FaceLandmarker.createFromOptions(files, options("GPU"));
        } catch {
          tracker = await vision.FaceLandmarker.createFromOptions(files, options("CPU"));
        }
        if (cancelled) {
          tracker.close();
          return;
        }
        landmarkerRef.current = tracker;
        setLensState("ready");
      } catch {
        if (!cancelled) setLensState("failed");
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  // Camera stream (restarts after "retake" or flipping).
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

  // Live viewfinder: camera frame + the chosen lens, drawn every frame.
  useEffect(() => {
    if (shot) return;
    let raf = 0;
    let lastFrame = -1;
    let faces: Point[][] = [];
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(canvas.clientWidth * dpr);
      const ch = Math.round(canvas.clientHeight * dpr);
      if (!cw || !ch) return;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      let sw = vw;
      let sh = vh;
      if (sw / sh > cw / ch) sw = sh * (cw / ch);
      else sh = sw / (cw / ch);
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      const mirror = facingRef.current === "user";
      ctx.save();
      if (mirror) {
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
      ctx.restore();

      const current = lensRef.current;
      const tracker = landmarkerRef.current;
      if (!current.draw || !tracker) return;
      if (video.currentTime !== lastFrame) {
        lastFrame = video.currentTime;
        try {
          const result = tracker.detectForVideo(video, performance.now());
          faces = result.faceLandmarks.map((points) => points.map((pt) => {
            let x = (pt.x * vw - sx) * (cw / sw);
            const y = (pt.y * vh - sy) * (ch / sh);
            if (mirror) x = cw - x;
            return { x, y };
          }));
        } catch {
          faces = [];
        }
      }
      const now = performance.now();
      faces.forEach((points) => current.draw?.(ctx, buildFace(points), now));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [shot]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopStream();
      setFilterIndex(0);
      setSaved(null);
      setShot({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, at: new Date() });
    }, "image/jpeg", 0.92);
  };

  const pickLens = (index: number) => {
    railRef.current?.scrollTo({ left: index * LENS_STEP, behavior: "smooth" });
    setLensIndex(index);
  };

  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const index = Math.max(0, Math.min(LENSES.length - 1, Math.round(rail.scrollLeft / LENS_STEP)));
    if (index !== lensIndex) setLensIndex(index);
  };

  const shiftFilter = (step: number, at: number) => {
    let next = filterIndex;
    for (let i = 0; i < FILTERS.length; i += 1) {
      next = (next + step + FILTERS.length) % FILTERS.length;
      if (!isLocked(FILTERS[next])) break;
      if (i === 0) setHint({ text: `🔒 ${FILTERS[next].name} unlocks at a ${needsFor(FILTERS[next])}-day streak`, at });
    }
    setFilterIndex(next);
  };

  // Bake the chosen filter into the photo.
  const bake = async () => {
    if (!shot) throw new Error("No snap");
    const image = new Image();
    image.src = shot.url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = shot.width;
    canvas.height = shot.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(image, 0, 0);
    paintFilter(ctx, canvas.width, canvas.height, filter, shot.at);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not save the snap");
    return new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const saveToMemories = async () => {
    if (saved && saved.filter === filterIndex) return saved.id;
    const uploaded = await uploadFile(await bake());
    const snap = await api<{ id: string }>("/api/snaps", { method: "POST", body: JSON.stringify({ mediaUrl: uploaded.url }) });
    setSaved({ id: snap.id, filter: filterIndex });
    return snap.id;
  };

  const save = async () => {
    if (busy) return;
    setBusy("save");
    setError("");
    try {
      await saveToMemories();
    } catch {
      setError("Could not save to Memories. Try again.");
    } finally {
      setBusy("");
    }
  };

  // Every sent snap is also kept in Memories, like Snapchat.
  const send = async () => {
    if (busy) return;
    setBusy("send");
    setError("");
    try {
      const id = await saveToMemories();
      await api(`/api/snaps/${id}/send`, { method: "POST", body: JSON.stringify({ viewOnce }) });
      onSent();
      onClose();
    } catch {
      setError("Could not send the snap. Try again.");
    } finally {
      setBusy("");
    }
  };

  const retake = () => {
    setError("");
    setShot(null);
  };

  const close = () => {
    stopStream();
    onClose();
  };

  const isSaved = Boolean(saved && saved.filter === filterIndex);

  return (
    <div className={styles.camera}>
      <div
        className={styles.stage}
        onTouchStart={(event) => { swipeX.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (swipeX.current === null) return;
          const dx = event.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (Math.abs(dx) < 50) return;
          if (shot) shiftFilter(dx < 0 ? 1 : -1, event.timeStamp);
          else pickLens(Math.max(0, Math.min(LENSES.length - 1, lensIndex + (dx < 0 ? 1 : -1))));
        }}
      >
        <video ref={videoRef} className={styles.hiddenVideo} autoPlay playsInline muted />

        {shot ? (
          <>
            <img src={shot.url} alt="Your snap" className={styles.feed} style={{ filter: cssFilter(filter.ops) }} />
            {filter.tint && <div className={styles.tint} style={{ background: filter.tint }} />}
            {filter.stickers?.map((sticker, index) => (
              <span
                key={`${filter.id}-${index}`}
                className={styles.sticker}
                style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, fontSize: `${sticker.size * 100}cqw` }}
              >
                {sticker.emoji}
              </span>
            ))}
            {filter.label && (
              <span className={`${styles.snapLabel} ${filter.label === "time" ? styles.snapLabelBig : ""}`}>
                {labelText(filter.label, shot.at)}
              </span>
            )}
            <div key={filter.id} className={styles.filterName}>{filter.name}</div>
            <div className={styles.filterDots}>
              {FILTERS.map((item, index) => (
                <span key={item.id} className={`${index === filterIndex ? styles.dotOn : ""} ${isLocked(item) ? styles.dotLocked : ""}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <canvas ref={canvasRef} className={styles.feed} />
            {lens.draw && lensState === "loading" && <p className={styles.lensNote}>Loading lenses…</p>}
            {lens.draw && lensState === "failed" && <p className={styles.lensNote}>Lenses aren&apos;t supported on this browser. Filters still work after you snap.</p>}
          </>
        )}

        {hint && <div key={hint.at} className={styles.filterHint}>{hint.text}</div>}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.topBar}>
          <button type="button" className={styles.round} onClick={shot ? retake : close} aria-label={shot ? "Discard snap" : "Close camera"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {shot ? (
            <button type="button" className={`${styles.round} ${isSaved ? styles.roundOn : ""}`} onClick={() => void save()} disabled={busy !== ""} aria-label="Save to Memories">
              {busy === "save" ? (
                <span className={styles.spin} />
              ) : isSaved ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></svg>
              )}
            </button>
          ) : (
            <button type="button" className={styles.round} onClick={() => { setError(""); setFacing((f) => (f === "user" ? "environment" : "user")); }} aria-label="Flip camera">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
                <path d="M9 13.5a3 3 0 0 1 5.2-2" /><polyline points="14.5 9.5 14.5 11.6 12.4 11.6" />
                <path d="M15 12.5a3 3 0 0 1-5.2 2" /><polyline points="9.5 16.5 9.5 14.4 11.6 14.4" />
              </svg>
            </button>
          )}
        </div>
        {shot && <p className={styles.swipeTip}>Swipe for filters</p>}
        {isSaved && <p className={styles.savedTip}>Saved to Memories</p>}
      </div>

      {shot ? (
        <div className={styles.reviewBar}>
          <button type="button" className={`${styles.onceToggle} ${viewOnce ? styles.onceOn : ""}`} onClick={() => setViewOnce((v) => !v)}>
            👁️ {viewOnce ? "View once" : "Keep in chat"}
          </button>
          <button type="button" className={styles.sendSnap} onClick={() => void send()} disabled={busy !== ""}>
            {busy === "send" ? "Sending…" : `Send to ${partnerName}`}
            {busy !== "send" && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>}
          </button>
        </div>
      ) : (
        <div className={styles.controls}>
          <p key={lens.id} className={styles.lensName}>{lens.name}</p>
          <div className={styles.railWrap}>
            <div ref={railRef} className={styles.rail} onScroll={onRailScroll}>
              {LENSES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.lensItem} ${index === lensIndex ? styles.lensItemOn : ""}`}
                  onClick={() => (index === lensIndex ? capture() : pickLens(index))}
                  aria-label={index === lensIndex ? "Take snap" : `${item.name} lens`}
                >
                  {item.icon}
                </button>
              ))}
            </div>
            <button type="button" className={styles.shutter} onClick={capture} disabled={!!error} aria-label="Take snap" />
          </div>
          <div className={styles.bottomRow}>
            <button type="button" className={styles.memoriesBtn} onClick={() => setShowMemories(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
              Memories
            </button>
          </div>
        </div>
      )}

      {showMemories && (
        <SnapMemories partnerName={partnerName} onClose={() => setShowMemories(false)} onSent={() => { onSent(); onClose(); }} />
      )}
    </div>
  );
}
