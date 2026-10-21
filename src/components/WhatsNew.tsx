"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./WhatsNew.module.css";
import { api } from "@/lib/api";
import { LATEST_RELEASE } from "@/lib/releases";

const SEEN_KEY = "lt_seen_release";
const BUILD = process.env.NEXT_PUBLIC_APP_VERSION || "";

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Shows "What's new" once after each release, and a small "Update ready" banner
 * when a newer version is live but this phone is still running the old one.
 */
export default function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  // Release notes: once per release, a moment after the app opens.
  useEffect(() => {
    if (!LATEST_RELEASE || readSeen() === LATEST_RELEASE.id) return;
    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  // A newer build is live: offer to refresh (phones keep the old one until restarted).
  useEffect(() => {
    if (!BUILD) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      api<{ version: string }>("/api/version")
        .then((live) => { if (live.version && live.version !== BUILD) setUpdateReady(true); })
        .catch(() => undefined);
    };
    check();
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, LATEST_RELEASE.id);
    } catch {
      // Private mode: it may show again next time, which is fine.
    }
    setOpen(false);
  };

  return (
    <>
      {updateReady && !open && (
        <div className={styles.banner} role="status">
          <span className={styles.bannerDot} />
          <span className={styles.bannerText}>A new update is ready</span>
          <button type="button" className={styles.bannerBtn} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}

      {open && createPortal(
        <div className={styles.scrim} onClick={close}>
          <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.hero}>
              <img src="/new-logo.png" alt="" className={styles.logo} />
              <span className={styles.kicker}>What&apos;s new · {LATEST_RELEASE.date}</span>
              <h2 id="whats-new-title" className={styles.title}>{LATEST_RELEASE.title}</h2>
            </div>
            <ul className={styles.list}>
              {LATEST_RELEASE.items.map((item, index) => (
                <li key={item.title} style={{ animationDelay: `${0.08 + index * 0.06}s` }}>
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.itemText}>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.cta} onClick={close}>Got it</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
