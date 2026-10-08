"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getToken, shownName } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import styles from "./GamesScreen.module.css";

type Kind = "same" | "know" | "turn";

type GameView = {
  kind: Kind;
  round: number;
  total: number;
  prompt: string;
  a: string;
  b: string;
  mine: string;
  myGuess: string;
  partnerPick: string;
  partnerGuess: string;
  partnerLocked: boolean;
  iLocked: boolean;
  revealed: boolean;
  matches: number;
  myKnown: number;
  partnerKnown: number;
  turnMine: boolean;
  finished: boolean;
  waitingPartner: boolean;
};

const GAMES: { id: Kind; title: string; line: string; tone: string }[] = [
  { id: "same", title: "Same Page", line: "Pick together. See if you match.", tone: styles.toneSun },
  { id: "know", title: "Know Me", line: "Guess what they would choose.", tone: styles.toneRose },
  { id: "turn", title: "Our Turn", line: "A deck of little prompts, one at a time.", tone: styles.toneLilac },
];

export default function GamesScreen({ onBack }: { onBack: () => void }) {
  const { partner } = useSession();
  const partnerName = shownName(partner, "them");
  const [view, setView] = useState<GameView | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mine, setMine] = useState("");
  const [guess, setGuess] = useState("");
  const roundKey = useRef("");

  useEffect(() => {
    const next = io(API_URL, { auth: { token: getToken() } });
    setSocket(next);
    next.on("game:state", (state: GameView | null) => {
      const key = state ? `${state.kind}:${state.round}:${state.finished}` : "";
      if (key !== roundKey.current) {
        roundKey.current = key;
        setMine("");
        setGuess("");
      }
      setView(state);
    });
    next.emit("game:sync");
    return () => {
      next.disconnect();
    };
  }, []);

  const leave = () => {
    if (view) socket?.emit("game:leave");
    onBack();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={leave} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>{view ? GAMES.find((item) => item.id === view.kind)?.title : "Play"}</h1>
      </header>

      {!view && (
        <div className={styles.lobby}>
          <p className={styles.lead}>Open Play on both phones, then pick a game. You will see the same round.</p>
          {GAMES.map((game) => (
            <button key={game.id} type="button" className={`${styles.gameCard} ${game.tone}`} onClick={() => socket?.emit("game:start", game.id)}>
              <span className={styles.gameTitle}>{game.title}</span>
              <span className={styles.gameLine}>{game.line}</span>
            </button>
          ))}
        </div>
      )}

      {view && !view.finished && view.kind !== "turn" && (
        <div className={styles.play}>
          <p className={styles.round}>{view.round + 1} of {view.total}</p>
          <h2 className={styles.prompt}>{view.prompt}</h2>
          {view.waitingPartner && <p className={styles.wait}>Waiting for {partnerName} to open Play.</p>}

          {view.kind === "same" && (
            <div className={styles.choices}>
              <Choice label={view.a} selected={view.mine === "a" || (!view.iLocked && mine === "a")} disabled={view.iLocked} onClick={() => socket?.emit("game:move", { type: "pick", choice: "a" })} />
              <Choice label={view.b} selected={view.mine === "b" || (!view.iLocked && mine === "b")} disabled={view.iLocked} onClick={() => socket?.emit("game:move", { type: "pick", choice: "b" })} />
            </div>
          )}

          {view.kind === "know" && !view.iLocked && (
            <>
              <p className={styles.section}>What you would pick</p>
              <div className={styles.choices}>
                <Choice label={view.a} selected={mine === "a"} onClick={() => setMine("a")} />
                <Choice label={view.b} selected={mine === "b"} onClick={() => setMine("b")} />
              </div>
              <p className={styles.section}>What you think {partnerName} would pick</p>
              <div className={styles.choices}>
                <Choice label={view.a} selected={guess === "a"} onClick={() => setGuess("a")} />
                <Choice label={view.b} selected={guess === "b"} onClick={() => setGuess("b")} />
              </div>
              <button
                type="button"
                className={styles.primary}
                disabled={!mine || !guess}
                onClick={() => socket?.emit("game:move", { type: "pick", choice: mine, guess })}
              >
                Lock it in
              </button>
            </>
          )}

          {view.iLocked && !view.revealed && <p className={styles.wait}>Waiting for {partnerName}.</p>}

          {view.revealed && (
            <div className={styles.reveal}>
              {view.kind === "same" && (
                <p className={view.mine && view.mine === view.partnerPick ? styles.match : styles.apart}>
                  {view.mine && view.mine === view.partnerPick ? "You matched." : "You picked differently."}
                </p>
              )}
              {view.kind === "know" && (
                <>
                  <p>{partnerName} picked {view.partnerPick === "b" ? view.b : view.a}.</p>
                  <p className={view.myGuess && view.myGuess === view.partnerPick ? styles.match : styles.apart}>
                    {view.myGuess === view.partnerPick ? "You knew them." : "Not this one."}
                  </p>
                </>
              )}
              <p className={styles.score}>
                {view.kind === "same" ? `${view.matches} matches` : `You ${view.myKnown} · ${partnerName} ${view.partnerKnown}`}
              </p>
              <button type="button" className={styles.primary} onClick={() => socket?.emit("game:move", { type: "next" })}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {view && !view.finished && view.kind === "turn" && (
        <div className={styles.play}>
          <p className={styles.round}>{view.round + 1} of {view.total}</p>
          {view.waitingPartner && <p className={styles.wait}>Waiting for {partnerName} to open Play.</p>}
          <article className={styles.turnCard}>
            <p className={styles.turnLabel}>{view.prompt}</p>
            <h2 className={styles.turnText}>{view.a}</h2>
            <p className={styles.turnWho}>{view.turnMine ? "Your turn to go first." : `${partnerName} goes first. You can answer too.`}</p>
          </article>
          <button type="button" className={styles.primary} onClick={() => socket?.emit("game:move", { type: "next" })}>
            Next card
          </button>
        </div>
      )}

      {view?.finished && (
        <div className={styles.play}>
          <h2 className={styles.prompt}>That was a good round.</h2>
          {view.kind === "same" && <p className={styles.score}>{view.matches} matches out of {view.total}.</p>}
          {view.kind === "know" && <p className={styles.score}>You knew {partnerName} {view.myKnown} times. They knew you {view.partnerKnown} times.</p>}
          {view.kind === "turn" && <p className={styles.score}>You went through the whole deck.</p>}
          <button type="button" className={styles.primary} onClick={() => socket?.emit("game:start", view.kind)}>Play again</button>
          <button type="button" className={styles.quiet} onClick={() => socket?.emit("game:leave")}>Back to games</button>
        </div>
      )}
    </div>
  );
}

function Choice({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.choice} ${selected ? styles.choiceOn : ""}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
