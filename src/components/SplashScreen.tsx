"use client";

import { useEffect } from "react";
import styles from "./SplashScreen.module.css";

interface Props {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: Props) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 1800);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className={styles.splash}>
      <img src="/icon.png" alt="Little Temptation" className={styles.logo} />
    </div>
  );
}
