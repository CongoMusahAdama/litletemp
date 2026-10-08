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
    const timer = setTimeout(() => continueRef.current(), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.splash}>
      <img src="/icon.png" alt="Little Temptation" className={styles.logo} />
    </div>
  );
}
