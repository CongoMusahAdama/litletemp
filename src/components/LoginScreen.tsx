"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import styles from "./LoginScreen.module.css";
import { api, setToken } from "@/lib/api";
import { useSession } from "@/context/SessionContext";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const { refresh } = useSession();
  const [step, setStep] = useState<"intro" | "action_choice" | "start_names" | "share_code" | "join_code">("intro");
  const [myName, setMyName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartNew = () => {
    setStep("start_names");
  };

  const handleJoinPartner = () => {
    setStep("join_code");
  };

  const generateCode = async () => {
    if (!myName.trim() || !partnerName.trim()) return;
    setLoading(true);
    try {
      const data = await api<{ token: string; couple: { inviteCode: string } }>("/api/auth/start", {
        method: "POST",
        body: JSON.stringify({ myName, partnerName }),
      });
      setToken(data.token);
      setGeneratedCode(data.couple.inviteCode);
      setWaiting(true);
      setStep("share_code");
    } catch (error) {
      Swal.fire({ title: "Could not create a code", text: error instanceof Error ? error.message : "Try again", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  const verifyJoinCode = async () => {
    if (!myName.trim() || pairingCode.length < 4) return;
    setLoading(true);
    try {
      const data = await api<{ token: string; returning?: boolean }>("/api/auth/join", {
        method: "POST",
        body: JSON.stringify({ myName, pairingCode }),
      });
      setToken(data.token);
      await refresh();
      await Swal.fire({
        title: data.returning ? "Welcome back" : "Bond Connected!",
        text: data.returning
          ? "You are signed in again. Your messages are still here."
          : "You are paired. Messages, journal, and moods now stay in sync.",
        icon: "success",
        confirmButtonColor: "#1a1a1a",
        background: "#ffffff",
        color: "#1a1a1a",
        confirmButtonText: "Enter our space"
      });
      onLogin();
    } catch (error) {
      Swal.fire({ title: "Could not join", text: error instanceof Error ? error.message : "Try again", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      try {
        const data = await api<{ partner: { name: string } | null }>("/api/auth/me");
        if (data.partner) {
          clearInterval(timer);
          setWaiting(false);
          await refresh();
          await Swal.fire({
            title: "Partner Joined!",
            text: `${data.partner.name} entered the pairing code.`,
            icon: "success",
            confirmButtonColor: "#1a1a1a",
            background: "#ffffff",
            color: "#1a1a1a",
            confirmButtonText: "Enter our space"
          });
          onLogin();
        }
      } catch {
        // Keep waiting while the invite is still open.
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [waiting, onLogin, refresh]);

  const handleBack = () => {
    if (step === "action_choice") {
      setStep("intro");
    } else if (step === "start_names" || step === "join_code") {
      setStep("action_choice");
    } else if (step === "share_code") {
      setStep("start_names");
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        
        {step === "intro" && (
          <div className={styles.welcome}>
            <div className={styles.welcomeTop}>
              <h1 className={styles.welcomeTitle}>Just the<br />two of you</h1>
              <div className={styles.welcomeRow}>
                <p className={styles.welcomeText}>
                  A private little world for you and your person. Nobody else gets in.
                </p>
                <button className={styles.welcomeNext} onClick={() => setStep("action_choice")} aria-label="Continue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.pairStage}>
              <div className={`${styles.memory} ${styles.memoryYou}`}>
                <span className={styles.bubble} aria-hidden="true">
                  <span className={styles.eye} />
                  <span className={styles.eye} />
                  <span className={styles.smile} />
                </span>
                <span className={styles.memoryLabel}>you</span>
              </div>
              <div className={styles.floatHeart} aria-hidden="true">♥</div>
              <div className={`${styles.memory} ${styles.memoryMe}`}>
                <span className={styles.bubble} aria-hidden="true">
                  <span className={styles.eye} />
                  <span className={`${styles.eye} ${styles.wink}`} />
                  <span className={styles.smile} />
                </span>
                <span className={styles.memoryLabel}>your person</span>
              </div>
            </div>

            <div className={styles.handsWrap}>
              <svg className={styles.hands} viewBox="0 0 360 230" aria-hidden="true">
                <path d="M18 230 C22 168 48 132 86 108 C64 78 78 36 118 42 C132 18 168 28 168 64 C168 92 146 112 124 118 C150 132 168 160 168 198 L168 230 Z" fill="#FFE14A" stroke="#1a1a1a" strokeWidth="7" strokeLinejoin="round" />
                <path d="M342 230 C338 168 312 132 274 108 C296 78 282 36 242 42 C228 18 192 28 192 64 C192 92 214 112 236 118 C210 132 192 160 192 198 L192 230 Z" fill="#FFE14A" stroke="#1a1a1a" strokeWidth="7" strokeLinejoin="round" />
                <path d="M180 78 C180 58 198 46 214 56 C226 40 252 46 252 70 C252 98 214 124 214 124 C214 124 180 100 180 78 Z" fill="#fff" stroke="#1a1a1a" strokeWidth="6" strokeLinejoin="round" />
              </svg>
              <div className={styles.welcomeDots}>
                <span />
                <span className={styles.dotOn} />
              </div>
            </div>
          </div>
        )}

        {step === "action_choice" && (
          <div className={styles.namesScreen}>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>How would you like to begin?</h1>
            </div>

            <div className={styles.picks}>
              <button
                className={`${styles.pickCard} ${styles.cardMe}`}
                onClick={handleStartNew}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: '#F59E0B' }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>Start a New Bond</h3>
                  <p>I want to invite my partner</p>
                </div>
              </button>

              <button
                className={`${styles.pickCard} ${styles.cardBabe}`}
                onClick={handleJoinPartner}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: '#F97316' }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>Join my Partner</h3>
                  <p>I have a pairing code</p>
                </div>
              </button>
            </div>
            
            <button className={styles.backBtn} onClick={handleBack} style={{ margin: "auto auto 20px" }}>
              Back
            </button>
          </div>
        )}

        {step === "start_names" && (
          <div className={styles.namesScreen}>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepDot} />
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Who is<br/>pairing up?</h1>
            </div>

            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your Name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., Sarah"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Partner's Name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., James"
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                />
              </div>
            </div>

            <button 
              className={styles.getStartedBtn} 
              onClick={generateCode} 
              disabled={!myName.trim() || !partnerName.trim() || loading}
            >
              {loading ? "Generating..." : "Create Invite Code"}
            </button>

            <button className={styles.backBtn} onClick={handleBack}>
              Back
            </button>
          </div>
        )}

        {step === "share_code" && (
          <div className={styles.codeScreen}>
            <button className={styles.codeBack} onClick={handleBack}>Back</button>
            <div className={styles.codeBody}>
              <img src="/icon.png" alt="" className={styles.codeMark} />
              <p className={styles.codeKicker}>For {partnerName}</p>
              <h1 className={styles.codeTitle}>Your pairing code</h1>
              <p className={styles.codeLead}>Send it only to {partnerName}. It closes in 7 days.</p>
              <button
                className={styles.codeTicket}
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {generatedCode}
              </button>
              <p className={styles.codeWait}>
                <span className={styles.codePulse} />
                Waiting for {partnerName}
              </p>
            </div>
            <button
              className={styles.codeCopy}
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
        )}

        {step === "join_code" && (
          <div className={styles.connectScreen}>
            <div className={styles.headerPick}>
              <div className={styles.stepper}>
                <span className={styles.stepDot} />
                <span className={styles.stepActive} />
                <span className={styles.stepDot} />
                <span className={styles.stepDot} />
              </div>
              <h1 className={styles.titlePick}>Join your partner</h1>
              <p className={styles.subtitlePick}>Enter your name and the code you received.</p>
            </div>

            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your Name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., James"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                />
              </div>

              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Pairing Code</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., BOND-1234"
                  value={pairingCode}
                  onChange={e => setPairingCode(e.target.value.toUpperCase())}
                  style={{ textTransform: "uppercase", letterSpacing: "2px" }}
                />
              </div>
            </div>

            <button 
              className={styles.connectConfirmBtn} 
              onClick={verifyJoinCode} 
              disabled={!myName.trim() || pairingCode.length < 4 || loading}
              style={{ width: "calc(100% - 40px)", margin: "0 auto 20px" }}
            >
              {loading ? <div className={styles.spinner} /> : "Connect"}
            </button>

            <button className={styles.backBtn} onClick={handleBack}>
              Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
