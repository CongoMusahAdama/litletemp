"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import styles from "./CoupleOverlays.module.css";
import { API_URL, api, getToken, setToken, shownName } from "@/lib/api";
import { useSession } from "@/context/SessionContext";

const FACES: Record<string, string> = {
  Happy: "😊",
  "In Love": "🥰",
  Excited: "🤩",
  Calm: "😌",
  "Missing You": "🥺",
  Tired: "😴",
  Sad: "😢",
  Angry: "😠",
  Neutral: "😐",
};

export function prettyId(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function PairingBoard() {
  const { user, couple, partner, refresh } = useSession();
  const [copied, setCopied] = useState("");
  const [checking, setChecking] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let stopped = false;
    let pending = false;
    const tick = () => {
      if (stopped || pending || document.visibilityState === "hidden") return;
      pending = true;
      const controller = new AbortController();
      const kill = window.setTimeout(() => controller.abort(), 8000);
      refreshRef.current(controller.signal).finally(() => {
        window.clearTimeout(kill);
        pending = false;
      });
    };
    const timer = window.setInterval(tick, 2000);
    const onWake = () => tick();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    tick();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, []);

  const checkAgain = async () => {
    setChecking(true);
    try {
      await refresh();
    } catch {
      // The screen stays until the bond is active.
    } finally {
      setChecking(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1400);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className={styles.gate}>
      <p className={styles.kicker}>Allow your partner in</p>
      <h1 className={styles.title}>Tell them this ID and password</h1>
      <p className={styles.lead}>They type it once. After you are connected, each of you chooses a private password.</p>
      <div className={styles.card}>
        <div className={styles.row}>
          <span>Your ID</span>
          <strong>{prettyId(user?.accessId)}</strong>
        </div>
        <div className={styles.row}>
          <span>Password</span>
          <strong>{couple?.gatePassword}</strong>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => copy("id", user?.accessId || "")}>{copied === "id" ? "ID copied" : "Copy ID"}</button>
        <button type="button" onClick={() => copy("password", couple?.gatePassword || "")}>{copied === "password" ? "Password copied" : "Copy password"}</button>
      </div>
      <p className={styles.wait}>{partner ? `${shownName(partner)} is here` : "Waiting for your partner"}</p>
      <button type="button" className={styles.primary} onClick={checkAgain} disabled={checking}>
        {checking ? "Checking..." : "Check again"}
      </button>
    </div>
  );
}

export function PasswordSetup() {
  const { user, refresh } = useSession();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 4 || password !== again) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api<{ token?: string }>("/api/auth/set-password", { method: "POST", body: JSON.stringify({ password }) });
      if (saved.token) setToken(saved.token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.gate}>
      <p className={styles.kicker}>You are paired</p>
      <h1 className={styles.title}>Choose your password</h1>
      <p className={styles.lead}>
        Next time, sign in with your ID <strong>{prettyId(user?.accessId)}</strong> and this password. You will not pair again.
      </p>
      <label className={styles.field}>
        New password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" autoFocus />
      </label>
      <label className={styles.field}>
        Confirm password
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Same password again" onKeyDown={(e) => e.key === "Enter" && save()} />
      </label>
      {password && again && password !== again && <p className={styles.error}>Passwords do not match</p>}
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={save} disabled={password.length < 4 || password !== again || saving}>
        {saving ? "Saving..." : "Save password"}
      </button>
    </div>
  );
}

type MoodNotice = {
  mood: string;
  name: string;
  mine: boolean;
  quiet?: boolean;
};

export function MoodPopup() {
  const { user, partner } = useSession();
  const [notice, setNotice] = useState<MoodNotice | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const seenKey = (mood: string, who: string) => `lt_mood_${who}_${today}_${mood}`;

    api<{ partner: Record<string, string>; today: string }>("/api/moods")
      .then((data) => {
        const mood = data.partner?.[data.today];
        if (!mood || localStorage.getItem(seenKey(mood, "partner"))) return;
        setNotice({
          mood,
          name: shownName(partner, "Your person"),
          mine: false,
        });
      })
      .catch(() => undefined);

    api<{ lastMessage: { createdAt?: string; type?: string } | null }>("/api/chat/summary")
      .then((summary) => {
        const at = summary.lastMessage?.createdAt ? new Date(summary.lastMessage.createdAt).getTime() : 0;
        const quiet = at > 0 && Date.now() - at > 24 * 60 * 60 * 1000;
        if (!quiet || localStorage.getItem(`lt_quiet_${today}`)) return;
        setNotice((current) => current || {
          mood: "Missing You",
          name: shownName(partner, "Your person"),
          mine: false,
          quiet: true,
        });
      })
      .catch(() => undefined);

    const socket = io(API_URL, { auth: { token: getToken() } });
    socket.on("mood:updated", (payload: { mood: string; userId: string; name?: string }) => {
      const mine = String(payload.userId) === String(user.id);
      setNotice({
        mood: payload.mood,
        name: mine ? "You" : (payload.name || shownName(partner, "Your person")),
        mine,
      });
      setReply("");
    });
    socket.on("partner:joined", () => undefined);
    return () => { socket.disconnect(); };
  }, [user?.id, partner?.id]);

  if (!notice) return null;

  const close = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (notice.quiet) localStorage.setItem(`lt_quiet_${today}`, "1");
    else localStorage.setItem(`lt_mood_${notice.mine ? "me" : "partner"}_${today}_${notice.mood}`, "1");
    setNotice(null);
    setReply("");
  };

  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      await api("/api/chat/messages", { method: "POST", body: JSON.stringify({ type: "text", text }) });
      close();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.moodScrim} role="dialog" aria-modal="true">
      <div className={styles.moodCard}>
        <div className={styles.face}>{FACES[notice.mood] || "💛"}</div>
        <h2>{notice.quiet ? "It has been quiet in here" : notice.mine ? `You feel ${notice.mood}` : `${notice.name} feels ${notice.mood}`}</h2>
        <p>{notice.mine ? "Your partner can see this now." : "What do you think about me?"}</p>
        {!notice.mine && (
          <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Tell them what you think"
            />
            <button type="submit" disabled={!reply.trim() || sending}>{sending ? "Sending" : "Send"}</button>
          </form>
        )}
        <button type="button" className={styles.ghost} onClick={close}>Close</button>
      </div>
    </div>
  );
}
