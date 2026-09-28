"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import styles from "./LoginScreen.module.css";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [step, setStep] = useState<"pick" | "enter">("pick");
  const [who, setWho] = useState<"" | "me" | "babe">("");
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const PINS: Record<string, string> = {
    me: "1907",
    babe: "1907",
  };

  const handlePinTap = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => verifyPin(next), 150);
    }
  };

  const verifyPin = (entered: string) => {
    if (entered === PINS[who]) {
      setLoading(true);
      Swal.fire({
        title: "Welcome back!",
        text: `So happy to see you, ${who === "me" ? "love 💛" : "babe 🧡"}!`,
        icon: "success",
        confirmButtonColor: "#1a1a1a", 
        background: "#ffffff",
        color: "#1a1a1a",
        confirmButtonText: "Enter our space"
      }).then(() => {
        onLogin();
      });
    } else {
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleBack = () => {
    setStep("pick");
    setWho("");
    setPin("");
  };

  const selectUser = (user: "me" | "babe") => {
    setWho(user);
    setTimeout(() => {
      setStep("enter");
    }, 400); // Small delay to show selected state
  };

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        
        {step === "pick" ? (
          <>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Select<br/>who is opening</h1>
            </div>

            <div className={styles.picks}>
              <button
                id="btn-login-me"
                className={`${styles.pickCard} ${styles.cardMe} ${who === "me" ? styles.pickSelected : ""}`}
                onClick={() => selectUser("me")}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <span className={styles.emoji}>👱‍♀️</span>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>It&apos;s Me</h3>
                  <p>Primary access<br/>Just You.</p>
                </div>
                {who === "me" && (
                  <div className={styles.checkBadge}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>

              <button
                id="btn-login-babe"
                className={`${styles.pickCard} ${styles.cardBabe} ${who === "babe" ? styles.pickSelected : ""}`}
                onClick={() => selectUser("babe")}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <span className={styles.emoji}>👱‍♂️</span>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>My Babe</h3>
                  <p>Partner access<br/>Just Us.</p>
                </div>
                {who === "babe" && (
                  <div className={styles.checkBadge}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </>
        ) : (
          /* PIN entry */
          <div className={styles.pinArea}>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepDot} />
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Welcome back,<br/>{who === "me" ? "love 💛" : "babe 🧡"}</h1>
              <p className={styles.subtitleLeft}>Enter your 4-digit PIN</p>
            </div>

            <div className={`${styles.pinDots} ${shake ? styles.shake : ""}`}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`${styles.dot} ${i < pin.length ? styles.dotFilled : ""} ${loading && i < pin.length ? styles.dotSuccess : ""}`}
                />
              ))}
            </div>

            <div className={styles.keypad}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, idx) => (
                <button
                  key={idx}
                  id={`btn-pin-${k || "empty"}`}
                  className={`${styles.key} ${k === "" ? styles.keyEmpty : ""}`}
                  onClick={() => {
                    if (k === "⌫") setPin(p => p.slice(0, -1));
                    else if (k) handlePinTap(k);
                  }}
                  disabled={loading}
                >
                  {k}
                </button>
              ))}
            </div>

            <button id="btn-back" className={styles.backBtn} onClick={handleBack}>
              ← Not you?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
