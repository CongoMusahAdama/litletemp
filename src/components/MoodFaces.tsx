"use client";

import styles from "./MoodFaces.module.css";

export type FaceKind = "laugh" | "angry" | "neutral" | "smile" | "shock";

const FILL: Record<FaceKind, string> = {
  laugh: "#FBD24E",
  angry: "#EF5A3C",
  neutral: "#C8C8C8",
  smile: "#6CCB5F",
  shock: "#F07142",
};

const INK = "#1a1a1a";

export function Face({ kind, className }: { kind: FaceKind; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={FILL[kind]} />
      {kind === "laugh" && (
        <>
          <path d="M24 40 Q32 30 40 40" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M60 40 Q68 30 76 40" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M22 54 H78 Q76 84 50 84 Q24 84 22 54 Z" fill={INK} />
          <path d="M28 56 H72 V62 H28 Z" fill="#fff" />
          <path d="M38 76 Q50 68 62 76 Q56 82 50 82 Q44 82 38 76 Z" fill="#F0626B" />
        </>
      )}
      {kind === "angry" && (
        <>
          <path d="M22 34 L42 42" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M78 34 L58 42" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          <circle cx="34" cy="50" r="5" fill={INK} />
          <circle cx="66" cy="50" r="5" fill={INK} />
          <path d="M34 74 Q50 62 66 74" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === "neutral" && (
        <>
          <circle cx="36" cy="44" r="5" fill={INK} />
          <circle cx="64" cy="44" r="5" fill={INK} />
          <path d="M38 66 H62" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {kind === "smile" && (
        <>
          <path d="M26 44 Q34 36 42 44" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M58 44 Q66 36 74 44" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M32 60 Q50 76 68 60" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === "shock" && (
        <>
          <path d="M22 30 Q32 22 42 30" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M58 30 Q68 22 78 30" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="34" cy="44" r="9" fill="#fff" />
          <circle cx="66" cy="44" r="9" fill="#fff" />
          <circle cx="35" cy="45" r="4.5" fill={INK} />
          <circle cx="65" cy="45" r="4.5" fill={INK} />
          <ellipse cx="50" cy="72" rx="11" ry="13" fill={INK} />
          <ellipse cx="50" cy="78" rx="7" ry="5" fill="#F0626B" />
        </>
      )}
    </svg>
  );
}

/** The floating cluster of mood faces from the "How are you feeling today?" screen. */
export function FaceCluster({ highlight }: { highlight?: FaceKind }) {
  const faces: { kind: FaceKind; slot: string }[] = [
    { kind: "laugh", slot: styles.slotLaugh },
    { kind: "angry", slot: styles.slotAngry },
    { kind: "laugh", slot: styles.slotPeek },
    { kind: "neutral", slot: styles.slotNeutral },
    { kind: "smile", slot: styles.slotSmile },
    { kind: "shock", slot: styles.slotShock },
  ];
  return (
    <div className={styles.cluster} aria-hidden="true">
      {faces.map((face, index) => (
        <div
          key={index}
          className={`${styles.face} ${face.slot} ${highlight && highlight !== face.kind ? styles.dim : ""}`}
          style={{ animationDelay: `${index * -0.7}s` }}
        >
          <Face kind={face.kind} />
        </div>
      ))}
    </div>
  );
}
