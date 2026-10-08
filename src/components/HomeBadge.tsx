"use client";

import { useEffect, useState } from "react";
import { clearHomeBadge, enableHomeBadge, registerAppWorker } from "@/lib/badge";
import styles from "./HomeBadge.module.css";

export default function HomeBadge() {
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    void registerAppWorker();
    const sync = () => {
      if (document.visibilityState === "visible") void clearHomeBadge();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    const canAsk = "Notification" in window && Notification.permission === "default" && "setAppBadge" in navigator;
    setOffer(canAsk);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  if (!offer) return null;

  return (
    <button
      type="button"
      className={styles.bar}
      onClick={() => {
        void enableHomeBadge().then((ok) => {
          if (ok || !("Notification" in window) || Notification.permission !== "default") setOffer(false);
        });
      }}
    >
      Turn on the number on your home screen icon
    </button>
  );
}
