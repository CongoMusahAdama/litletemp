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
  const [step, setStep] = useState<"login" | "intro" | "how" | "action_choice" | "start_names" | "share_code" | "join_code" | "set_password">("intro");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [myName, setMyName] = useState("");
  const [myUsername, setMyUsername] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerUsername, setPartnerUsername] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [taken, setTaken] = useState<{ mine: boolean; partner: boolean }>({ mine: false, partner: false });

  const usernameReady = (value: string) => /^[a-z0-9_]{3,20}$/.test(value.trim().toLowerCase());

  const handleStartNew = () => {
    setStep("start_names");
  };

  const handleJoinPartner = () => {
    setStep("join_code");
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) return;
    setLoading(true);
    try {
      const data = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      setToken(data.token);
      await refresh();
      onLogin();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      Swal.fire({ title: "Sign in failed", text: msg || "Check your name and password", icon: "error", confirmButtonColor: "#1a1a1a" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 4 || newPassword !== newPasswordConfirm) return;
    setLoading(true);
    try {
      const saved = await api<{ token?: string }>("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      if (saved.token) setToken(saved.token);
      await refresh();
      onLogin();
    } catch (error) {
      Swal.fire({ title: "Could not save password", text: error instanceof Error ? error.message : "Try again", icon: "error", confirmButtonColor: "#1a1a1a" });
    } finally {
      setLoading(false);
    }
  };

  const openHost = async () => {
    if (myName.trim().length < 2) return;
    setLoading(true);
    try {
      const data = await api<{ token: string }>("/api/auth/host", {
        method: "POST",
        body: JSON.stringify({ name: myName.trim() }),
      });
      setToken(data.token);
      await refresh();
      onLogin();
    } catch (error) {
      Swal.fire({ title: "Could not open a space", text: error instanceof Error ? error.message : "Try again", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  const connectPartner = async () => {
    const accessId = pairingCode.replace(/\D/g, "");
    if (myName.trim().length < 2 || accessId.length !== 9 || loginPassword.trim().length < 4) return;
    setLoading(true);
    try {
      const data = await api<{ token: string }>("/api/auth/connect", {
        method: "POST",
        body: JSON.stringify({ name: myName.trim(), accessId, password: loginPassword.trim() }),
      });
      setToken(data.token);
      await refresh();
      onLogin();
    } catch (error) {
      Swal.fire({ title: "Could not connect", text: error instanceof Error ? error.message : "Try again", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handles = [myUsername, partnerUsername];
    if (!handles.some((value) => usernameReady(value))) return;
    const timer = setTimeout(async () => {
      const next = { mine: false, partner: false };
      await Promise.all(handles.map(async (value, index) => {
        if (!usernameReady(value)) return;
        try {
          const data = await api<{ taken: boolean }>(`/api/auth/username?username=${encodeURIComponent(value.trim().toLowerCase())}`);
          if (index === 0) next.mine = data.taken;
          else next.partner = data.taken;
        } catch {
          // The submit check still catches a taken username.
        }
      }));
      setTaken(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [myUsername, partnerUsername]);

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
    if (step === "login") {
      setStep("action_choice");
    } else if (step === "how") {
      setStep("intro");
    } else if (step === "action_choice") {
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

        {/* ── Quick Login ── */}
        {step === "login" && (
          <div className={styles.namesScreen}>
            <div className={styles.headerPick} style={{ paddingTop: 40 }}>
              <h1 className={styles.titlePick} style={{ fontSize: '30px' }}>Welcome back</h1>
              <p className={styles.subtitlePick}>Sign in with your name and the password you chose after pairing.</p>
            </div>
            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your name</label>
                <input
                  type="text"
                  id="input-login-username"
                  className={styles.nameInput}
                  placeholder="The name you paired with"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Password</label>
                <input
                  type="password"
                  id="input-login-password"
                  className={styles.nameInput}
                  placeholder="Your password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>
            <button
              id="btn-login"
              className={styles.getStartedBtn}
              onClick={handleLogin}
              disabled={loginUsername.trim().length < 2 || !loginPassword.trim() || loading}
            >
              {loading ? <div className={styles.spinner} /> : "Sign In"}
            </button>
            <button
              className={styles.backBtn}
              onClick={handleBack}
              style={{ margin: "12px auto 20px" }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Set Password (after first pairing) ── */}
        {step === "set_password" && (
          <div className={styles.namesScreen}>
            <div className={styles.headerPick} style={{ paddingTop: 40 }}>
              <h1 className={styles.titlePick}>Create your password</h1>
              <p className={styles.subtitlePick}>Next time you sign in with your name and this password.</p>
            </div>
            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>New password</label>
                <input
                  type="password"
                  id="input-new-password"
                  className={styles.nameInput}
                  placeholder="At least 4 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Confirm password</label>
                <input
                  type="password"
                  id="input-confirm-password"
                  className={styles.nameInput}
                  placeholder="Same password again"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                />
                {newPasswordConfirm && newPassword !== newPasswordConfirm && (
                  <p className={styles.nameHint}>Passwords do not match</p>
                )}
              </div>
            </div>
            <button
              id="btn-set-password"
              className={styles.getStartedBtn}
              onClick={handleSetPassword}
              disabled={newPassword.length < 4 || newPassword !== newPasswordConfirm || loading}
            >
              {loading ? <div className={styles.spinner} /> : "Save Password & Enter"}
            </button>
          </div>
        )}

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
                <span className={styles.dotOn} />
                <span />
              </div>
            </div>
            <button
              className={styles.backBtn}
              onClick={() => setStep("login")}
              style={{ margin: "0 auto 16px", fontSize: "14px" }}
            >
              Already have an account? Sign in
            </button>
          </div>
        )}

        {step === "how" && (
          <div className={styles.guide}>
            <div className={styles.guideTop}>
              <p className={styles.guideKicker}>How it works</p>
              <h1 className={styles.guideTitle}>A private space for two</h1>
              <p className={styles.guideLead}>Only you and your partner can see the chat, stories, and games.</p>
            </div>
            <ol className={styles.guideSteps}>
              <li>
                <span>1</span>
                <p><strong>One of you opens a space.</strong> An ID and a short password appear, like a remote-control code.</p>
              </li>
              <li>
                <span>2</span>
                <p><strong>The other person types that ID and password</strong> and taps connect. You only do this once.</p>
              </li>
              <li>
                <span>3</span>
                <p><strong>Each of you then chooses a private password.</strong> After that, sign in with your name and that password. The chat stays.</p>
              </li>
            </ol>
            <button type="button" className={styles.guideNext} onClick={() => setStep("action_choice")}>
              Continue
            </button>
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
              <h1 className={styles.titlePick}>Pair once, then just sign in</h1>
              <p className={styles.subtitlePick}>One of you shows an ID. The other types it. After that, each of you signs in with your name and a password.</p>
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
                  <h3>Show my ID</h3>
                  <p>Let my partner connect to me</p>
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
                  <h3>Connect to partner</h3>
                  <p>I have their ID and password</p>
                </div>
              </button>

              <button
                className={`${styles.pickCard} ${styles.cardMe}`}
                onClick={() => setStep("login")}
              >
                <div className={styles.cardGraphic}>
                  <div className={styles.graphicCircle}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: '#10B981' }}>
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                      <polyline points="10 17 15 12 10 7"></polyline>
                      <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h3>Sign in</h3>
                  <p>Name and password</p>
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
              <h1 className={styles.titlePick}>What should we call you?</h1>
              <p className={styles.subtitlePick}>This is the name you will use to sign in.</p>
            </div>
            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., Sarah"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              className={styles.getStartedBtn}
              onClick={openHost}
              disabled={myName.trim().length < 2 || loading}
            >
              {loading ? "Opening..." : "Show my ID"}
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
              <h1 className={styles.titlePick}>Connect to your partner</h1>
              <p className={styles.subtitlePick}>Use the ID and password on their screen. This name is how you sign in next time.</p>
            </div>
            <div className={styles.namesForm}>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Your name</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="e.g., James"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                />
              </div>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Partner ID</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="202 096 585"
                  inputMode="numeric"
                  value={pairingCode}
                  onChange={e => setPairingCode(e.target.value)}
                />
              </div>
              <div className={styles.nameField}>
                <label className={styles.nameLabel}>Password</label>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="The password on their screen"
                  inputMode="numeric"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                />
              </div>
            </div>
            <button
              className={styles.connectConfirmBtn}
              onClick={connectPartner}
              disabled={myName.trim().length < 2 || pairingCode.replace(/\D/g, "").length !== 9 || loginPassword.trim().length < 4 || loading}
            >
              {loading ? <div className={styles.spinner} /> : "Connect to partner"}
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
