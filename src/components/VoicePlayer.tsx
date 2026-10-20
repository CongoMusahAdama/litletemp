"use client";

import { useRef, useState } from "react";
import styles from "./VoicePlayer.module.css";
import { mediaUrl } from "@/lib/api";
import { noteAudio } from "@/lib/note";

// WhatsApp-style voice note: play button, real waveform you can scrub,
// 1x/1.5x/2x speed, and the sender's photo with a mic badge.
const PEAK_COUNT = 34;
const peakCache = new Map<string, number[]>();
const FALLBACK_PEAKS = Array.from({ length: PEAK_COUNT }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
const SPEEDS = [1, 1.5, 2];

// Real waveform of the recording, worked out once per file and remembered.
async function loadPeaks(src: string) {
  const cached = peakCache.get(src);
  if (cached) return cached;
  const context = noteAudio();
  if (!context) return FALLBACK_PEAKS;
  const data = await (await fetch(src)).arrayBuffer();
  const audio = await context.decodeAudioData(data);
  const samples = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(samples.length / PEAK_COUNT));
  const peaks: number[] = [];
  for (let i = 0; i < PEAK_COUNT; i += 1) {
    let sum = 0;
    for (let j = 0; j < block; j += 16) sum += Math.abs(samples[i * block + j] || 0);
    peaks.push(sum / (block / 16));
  }
  const max = Math.max(...peaks, 0.0001);
  const scaled = peaks.map((peak) => Math.max(0.12, peak / max));
  peakCache.set(src, scaled);
  return scaled;
}

export default function VoicePlayer({ src, mine = false, avatar, name = "" }: { src: string; mine?: boolean; avatar?: string; name?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [peaks, setPeaks] = useState<number[]>(() => peakCache.get(src) || FALLBACK_PEAKS);

  // Only fetch the real waveform once you press play, so opening the chat
  // doesn't download every voice note in it.
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!peakCache.has(src)) loadPeaks(src).then(setPeaks).catch(() => undefined);
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  const seek = (clientX: number) => {
    const audio = audioRef.current;
    const wave = waveRef.current;
    if (!audio || !wave || !audio.duration) return;
    const rect = wave.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const clock = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
  const shown = playing || progress > 0 ? duration * progress : duration;

  return (
    // Taps here control playback; they shouldn't count toward double-tap-for-menu.
    <div className={`${styles.voiceMsg} ${mine ? styles.voiceMine : ""}`} onClick={(event) => event.stopPropagation()} data-no-swipe>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
          event.currentTarget.playbackRate = speed;
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration) {
            setDuration(audio.duration);
            setProgress(audio.currentTime / audio.duration);
          }
        }}
      />
      <button type="button" className={styles.playBtn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>
      <div className={styles.voiceBody}>
        <div
          ref={waveRef}
          className={styles.waveform}
          onClick={(event) => seek(event.clientX)}
          onTouchMove={(event) => seek(event.touches[0].clientX)}
          role="slider"
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          {peaks.map((peak, index) => (
            <span
              key={index}
              className={`${styles.bar} ${(index + 0.5) / peaks.length <= progress ? styles.barPlayed : ""}`}
              style={{ height: `${Math.round(4 + peak * 20)}px` }}
            />
          ))}
          <span className={styles.waveKnob} style={{ left: `${progress * 100}%` }} />
        </div>
        <div className={styles.voiceMeta}>
          <span className={styles.voiceDur}>{clock(shown)}</span>
          {(playing || speed !== 1) && (
            <button type="button" className={styles.speedBtn} onClick={cycleSpeed} aria-label="Playback speed">
              {speed}×
            </button>
          )}
        </div>
      </div>
      <span className={`${styles.voiceAvatar} ${playing ? styles.voiceAvatarLive : ""}`} aria-hidden="true">
        {avatar ? <img src={mediaUrl(avatar)} alt="" /> : (
          <span className={styles.voiceInitial}>
            {name ? name.slice(0, 1) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z" /></svg>
            )}
          </span>
        )}
        <span className={`${styles.voiceMicBadge} ${progress > 0 || playing ? styles.voiceMicHeard : ""}`}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z" /></svg>
        </span>
      </span>
    </div>
  );
}
