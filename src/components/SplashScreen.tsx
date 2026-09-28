"use client";

import { useEffect, useState } from "react";
import styles from "./SplashScreen.module.css";

interface Props {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: Props) {
  const [phase, setPhase] = useState<"loading" | "success">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 15) + 5;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setTimeout(() => setPhase("success"), 500);
      }
      setProgress(current);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.splash}>
      {phase === "loading" ? (
        <div className={styles.loadingScreen}>
          {/* Stars */}
          <div className={`${styles.star} ${styles.star1}`}>✦</div>
          <div className={`${styles.star} ${styles.star2}`}>✦</div>
          <div className={`${styles.star} ${styles.star3}`}>✦</div>
          <div className={`${styles.star} ${styles.star4}`}>✦</div>

          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <span className={styles.progressText}>Creating our space...</span>
              <span className={styles.progressPercent}>{progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className={styles.character}>
            <div className={styles.rings}>
              <div className={styles.ring} />
              <div className={styles.ring} />
              <div className={styles.ring} />
              <div className={styles.ring} />
              <div className={styles.ring} />
            </div>
            <div className={styles.notebookFace}>
              <div className={styles.eyes}>
                <div className={styles.eye}>
                  <div className={styles.pupil} />
                </div>
                <div className={styles.eye}>
                  <div className={styles.pupil} />
                </div>
              </div>
              <svg className={styles.smile} viewBox="0 0 24 12" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round">
                <path d="M2 2 Q 12 14 22 2" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.successScreen}>
          <button className={styles.closeBtn} onClick={onContinue}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div className={styles.successContent}>
            <div className={styles.checkCircle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className={styles.successTitle}>Great!</h1>
            <p className={styles.successText}>
              We did another step to creating your<br/>private space
            </p>
          </div>

          <div className={styles.blobCharacter}>
            <div className={styles.blobEars}>
              <div className={styles.ear} />
              <div className={styles.ear} />
            </div>
            <div className={styles.blobFace}>
              <div className={styles.blobEyes}>
                <div className={styles.blobEye}>
                  <div className={styles.sparkle} />
                </div>
                <div className={styles.blobEye}>
                  <div className={styles.sparkle} />
                </div>
              </div>
              <svg className={styles.blobSmile} viewBox="0 0 24 12" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 2 Q 12 12 22 2" />
              </svg>
            </div>

            <button className={styles.homeBtn} onClick={onContinue}>
              To home screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
