"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import styles from "./LoginScreen.module.css";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [step, setStep] = useState<"intro" | "names" | "pick" | "enter">("intro");
  const [who, setWho] = useState<"" | "me" | "babe">("");
  const [pin, setPin] = useState("");
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
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
        text: `So happy to see you, ${who === "me" ? myName || "love" : partnerName || "babe"}!`,
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
    if (step === "enter") {
      setStep("pick");
      setWho("");
      setPin("");
    } else if (step === "names") {
      setStep("intro");
      setMyName("");
      setPartnerName("");
    }
  };

  const selectUser = (user: "me" | "babe") => {
    setWho(user);
    setTimeout(() => {
      setStep("enter");
    }, 300);
  };

  const handleNamesContinue = () => {
    if (!myName.trim() || !partnerName.trim()) return;
    setStep("pick");
  };

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        
        {step === "intro" ? (
          /* Lovely Intro Screen */
          <div className={styles.introScreen}>
            <div className={styles.introStars}>
              <span className={`${styles.introStar} ${styles.star1}`}>✦</span>
              <span className={`${styles.introStar} ${styles.star2}`}>✦</span>
              <span className={`${styles.introStar} ${styles.star3}`}>✦</span>
              <span className={`${styles.introStar} ${styles.star4}`}>✦</span>
            </div>

            <div className={styles.introContent}>
              <h1 className={styles.introTitle}>Little Temptation</h1>
              <p className={styles.introSubtitle}>Just You. Just Me. Just Us.</p>
              
              <div className={styles.introLovely}>
                <span className={styles.lovelyIcon} />
                <p className={styles.lovelyText}>A private space for two hearts</p>
                <span className={styles.lovelyIcon} />
              </div>

              <p className={styles.introDesc}>
                Share moments, leave love notes,<br/>and stay connected no matter the distance.
              </p>
            </div>

            <div className={styles.introCharacter}>
              <div className={styles.introRings}>
                <div className={styles.introRing} />
                <div className={styles.introRing} />
                <div className={styles.introRing} />
                <div className={styles.introRing} />
              </div>
              <div className={styles.introFace}>
                <div className={styles.introEyes}>
                  <div className={styles.introEye}>
                    <div className={styles.introPupil} />
                  </div>
                  <div className={styles.introEye}>
                    <div className={styles.introPupil} />
                  </div>
                </div>
                <svg className={styles.introSmile} viewBox="0 0 24 12" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round">
                  <path d="M2 2 Q 12 14 22 2" />
                </svg>
              </div>
            </div>

            <button id="btn-get-started" className={styles.getStartedBtn} onClick={() => setStep("names")}>
              Begin Our Journey
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        ) : step === "names" ? (
          /* Names Setup Screen */
          <div className={styles.namesScreen}>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>What should<br/>we call each other?</h1>
              <p className={styles.subtitlePick}>Your names will appear throughout the app</p>
            </div>

            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your Name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., Sarah, Alex, Mia..."
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  autoFocus
                  maxLength={20}
                />
                <span className={styles.nameHint}>This is how you'll see yourself</span>
              </div>

              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Partner's Name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., James, Emma, Sam..."
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  maxLength={20}
                />
                <span className={styles.nameHint}>This is what you'll call them</span>
              </div>

              <div className={styles.namePreview}>
                <p>Preview: <strong>{myName || "You"}</strong> & <strong>{partnerName || "Partner"}</strong></p>
              </div>
            </div>

            <button id="btn-names-continue" className={styles.getStartedBtn} onClick={handleNamesContinue} disabled={!myName.trim() || !partnerName.trim()}>
              Continue
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button id="btn-back-names" className={styles.backBtn} onClick={handleBack}>
              Back
            </button>
          </div>
        ) : step === "pick" ? (
          /* Pick who is opening */
          <>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepDot} />
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Select<br/>who is opening</h1>
            </div>

            <div className={styles.picks}>
              <button
                id="btn-login-me"
                className={`${styles.pickCard} ${styles.cardMe}`}
                onClick={() => selectUser("me")}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <span className={styles.emoji} />
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>It's Me</h3>
                  <p>Primary access<br/>Just {myName || "You"}.</p>
                </div>
              </button>

              <button
                id="btn-login-babe"
                className={`${styles.pickCard} ${styles.cardBabe}`}
                onClick={() => selectUser("babe")}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <span className={styles.emoji} />
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>My {partnerName || "Partner"}</h3>
                  <p>Partner access<br/>Just Us.</p>
                </div>
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
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Welcome back,<br/>{who === "me" ? (myName || "love") : (partnerName || "babe")}</h1>
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
              Not you?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
