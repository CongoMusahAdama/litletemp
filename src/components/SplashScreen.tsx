"use client";

import { useEffect, useRef } from "react";
import styles from "./SplashScreen.module.css";

interface Props {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: Props) {
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  useEffect(() => {
    const timer = setTimeout(() => continueRef.current(), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.splash}>
      <div className={styles.stage}>
        <span className={styles.ring} />
        <span className={`${styles.ring} ${styles.ringLate}`} />
        <span className={styles.glow} />
        <span className={`${styles.spark} ${styles.sparkA}`} />
        <span className={`${styles.spark} ${styles.sparkB}`} />
        <span className={`${styles.spark} ${styles.sparkC}`} />
        <div className={styles.float}>
          <img src="/new-logo.png" alt="Little Temptation" className={styles.logo} />
        </div>
        <span className={styles.shadow} />
      </div>
    </div>
  );
}
