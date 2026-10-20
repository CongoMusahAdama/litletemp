"use client";

import { useEffect, useRef, useState } from "react";
import { scopedSocket, type ScopedSocket } from "@/lib/socket";
import { api, mediaUrl, shownName, uploadFile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import styles from "./GamesScreen.module.css";
import VoicePlayer from "./VoicePlayer";

type Kind = "same" | "know" | "turn" | "spicy" | "tod";

type Reply = { text: string; mediaUrl: string; mediaType: "image" | "video" | "audio" | "" };

type GameView = {
  kind: Kind;
  round: number;
  total: number;
  prompt: string;
  a: string;
  b: string;
  custom: boolean;
  choice?: "Truth" | "Dare" | "";
  myReply?: Reply | null;
  partnerReply?: Reply | null;
  myAnswer: string;
  partnerAnswer: string;
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

type Card = { id: string; kind: Kind; prompt: string; a: string; b: string; mine: boolean };

const GAMES: { id: Kind; title: string; line: string; tone: string; badge?: string }[] = [
  { id: "same", title: "Same Page", line: "Pick together. See if you match.", tone: styles.toneSun },
  { id: "know", title: "Know Me", line: "Guess what they would choose.", tone: styles.toneRose },
  { id: "turn", title: "Our Turn", line: "Prompts you both answer, one card at a time.", tone: styles.toneLilac },
  { id: "tod", title: "Truth or Dare", line: "Pick truth or dare. Answer with words, photos, videos or voice notes.", tone: styles.toneTod, badge: "📸 🎤" },
  { id: "spicy", title: "After Dark", line: "Naughty truths and dares. Just for you two.", tone: styles.toneNight, badge: "18+ 🔥" },
];

const isWritten = (kind: Kind) => kind === "turn" || kind === "spicy";

export default function GamesScreen({ onBack }: { onBack: () => void }) {
  const { partner } = useSession();
  const partnerName = shownName(partner, "them");
  const [view, setView] = useState<GameView | null>(null);
  const [socket, setSocket] = useState<ScopedSocket | null>(null);
  const [mine, setMine] = useState("");
  const [guess, setGuess] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Kind | null>(null);
  const roundKey = useRef("");

  useEffect(() => {
    const next = scopedSocket();
    setSocket(next);
    next.on("game:state", (state: GameView | null) => {
      const key = state ? `${state.kind}:${state.round}:${state.finished}` : "";
      if (key !== roundKey.current) {
        roundKey.current = key;
        setMine("");
        setGuess("");
        setDraft("");
      }
      setView(state);
    });
    next.emit("game:sync");
    return () => {
      next.disconnect();
    };
  }, []);

  const leave = () => {
    if (editing) {
      setEditing(null);
      return;
    }
    if (view) socket?.emit("game:leave");
    onBack();
  };

  const sendAnswer = () => {
    const text = draft.trim();
    if (!text) return;
    socket?.emit("game:move", { type: "answer", text });
    setDraft("");
  };

  const game = GAMES.find((item) => item.id === (editing || view?.kind));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={leave} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>{editing ? `${game?.title} cards` : view ? game?.title : "Play"}</h1>
      </header>

      {editing && <CardEditor kind={editing} />}

      {!editing && !view && (
        <div className={styles.lobby}>
          <p className={styles.lead}>Open Play on both phones, then pick a game. You will see the same round. Tap ✏️ to add your own cards.</p>
          {GAMES.map((item) => (
            <div key={item.id} className={`${styles.gameCard} ${item.tone}`}>
              <button type="button" className={styles.gamePlay} onClick={() => socket?.emit("game:start", item.id)}>
                <span className={styles.gameTitle}>
                  {item.title}
                  {item.badge && <em className={styles.gameBadge}>{item.badge}</em>}
                </span>
                <span className={styles.gameLine}>{item.line}</span>
              </button>
              <button type="button" className={styles.gameEdit} onClick={() => setEditing(item.id)} aria-label={`Edit ${item.title} cards`}>
                ✏️
              </button>
            </div>
          ))}
        </div>
      )}

      {!editing && view && !view.finished && view.kind === "tod" && (
        <TruthOrDare view={view} partnerName={partnerName} socket={socket} />
      )}

      {!editing && view && !view.finished && !isWritten(view.kind) && view.kind !== "tod" && (
        <div className={styles.play}>
          <p className={styles.round}>{view.round + 1} of {view.total}{view.custom && <span className={styles.customTag}>✍️ Your card</span>}</p>
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

      {!editing && view && !view.finished && isWritten(view.kind) && (
        <div className={styles.play}>
          <p className={styles.round}>{view.round + 1} of {view.total}{view.custom && <span className={styles.customTag}>✍️ Your card</span>}</p>
          {view.waitingPartner && <p className={styles.wait}>Waiting for {partnerName} to open Play.</p>}
          <article className={`${styles.turnCard} ${view.kind === "spicy" ? styles.turnCardSpicy : ""}`}>
            <p className={styles.turnLabel}>{view.kind === "spicy" ? (view.prompt === "Dare" ? "😈 Dare" : "🔥 Truth") : view.prompt}</p>
            <h2 className={styles.turnText}>{view.a}</h2>
            <p className={styles.turnWho}>{view.turnMine ? "Your turn to go first." : `${partnerName} goes first. You can answer too.`}</p>
          </article>

          <div className={styles.answers}>
            {view.myAnswer && (
              <div className={`${styles.answerBubble} ${styles.answerMine}`}>
                <strong>You</strong>
                <p>{view.myAnswer}</p>
              </div>
            )}
            {view.partnerAnswer ? (
              <div className={styles.answerBubble}>
                <strong>{partnerName}</strong>
                <p>{view.partnerAnswer}</p>
              </div>
            ) : (
              view.myAnswer && <p className={styles.wait}>Waiting for {partnerName} to answer…</p>
            )}
          </div>

          <div className={styles.answerBox}>
            <textarea
              className={styles.answerInput}
              placeholder={view.myAnswer ? "Change your answer…" : view.kind === "spicy" ? "Be honest… or be bold 😏" : "Type your answer…"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={500}
            />
            <button type="button" className={styles.answerSend} onClick={sendAnswer} disabled={!draft.trim()} aria-label="Send answer">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>
            </button>
          </div>

          <button type="button" className={styles.primary} onClick={() => socket?.emit("game:move", { type: "next" })}>
            {view.kind === "spicy" && !view.myAnswer ? "Pass 🙈" : "Next card"}
          </button>
        </div>
      )}

      {!editing && view?.finished && (
        <div className={styles.play}>
          <h2 className={styles.prompt}>{view.kind === "spicy" ? "Well, that got hot. 🔥" : "That was a good round."}</h2>
          {view.kind === "same" && <p className={styles.score}>{view.matches} matches out of {view.total}.</p>}
          {view.kind === "know" && <p className={styles.score}>You knew {partnerName} {view.myKnown} times. They knew you {view.partnerKnown} times.</p>}
          {(isWritten(view.kind) || view.kind === "tod") && <p className={styles.score}>You went through the whole deck.</p>}
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

function CardEditor({ kind }: { kind: Kind }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [prompt, setPrompt] = useState(kind === "spicy" || kind === "tod" ? "Truth" : "");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const choices = kind === "same" || kind === "know";

  useEffect(() => {
    api<Card[]>(`/api/games/cards?kind=${kind}`).then(setCards).catch(() => setCards([]));
  }, [kind]);

  const add = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const card = await api<Card>("/api/games/cards", {
        method: "POST",
        body: JSON.stringify({ kind, prompt, a, b }),
      });
      setCards((prev) => [card, ...(prev || [])]);
      setA("");
      setB("");
      if (kind !== "spicy" && kind !== "tod") setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that card");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setCards((prev) => (prev || []).filter((card) => card.id !== id));
    api(`/api/games/cards/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  const ready = choices ? prompt.trim() && a.trim() && b.trim() : a.trim();

  return (
    <div className={styles.lobby}>
      <p className={styles.lead}>
        Cards you add here are played first. We fill the rest of each round automatically, so the game always works.
      </p>

      <div className={styles.editForm}>
        {(kind === "spicy" || kind === "tod") && (
          <div className={styles.toggle}>
            {["Truth", "Dare"].map((option) => (
              <button key={option} type="button" className={prompt === option ? styles.toggleOn : ""} onClick={() => setPrompt(option)}>
                {option === "Dare" ? "😈 Dare" : "🔥 Truth"}
              </button>
            ))}
          </div>
        )}
        {kind !== "spicy" && kind !== "tod" && (
          <input
            className={styles.field}
            placeholder={choices ? "The question, e.g. Our next holiday" : "Short label (optional), e.g. Memory"}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={80}
          />
        )}
        {choices ? (
          <div className={styles.fieldRow}>
            <input className={styles.field} placeholder="Choice A" value={a} onChange={(event) => setA(event.target.value)} maxLength={80} />
            <input className={styles.field} placeholder="Choice B" value={b} onChange={(event) => setB(event.target.value)} maxLength={80} />
          </div>
        ) : (
          <textarea
            className={styles.field}
            placeholder={kind === "spicy" ? (prompt === "Dare" ? "Dare them to…" : "Ask them something naughty…") : kind === "tod" ? (prompt === "Dare" ? "Dare them to… e.g. send a photo of…" : "Ask them a truth…") : "Write the prompt you want to play…"}
            value={a}
            onChange={(event) => setA(event.target.value)}
            rows={3}
            maxLength={200}
          />
        )}
        {error && <p className={styles.apart}>{error}</p>}
        <button type="button" className={styles.primary} onClick={() => void add()} disabled={!ready || saving}>
          {saving ? "Adding…" : "Add card"}
        </button>
      </div>

      <p className={styles.section}>Your cards {cards ? `(${cards.length})` : ""}</p>
      {cards?.length === 0 && <p className={styles.wait}>No cards yet. The built-in deck will be used.</p>}
      {cards?.map((card) => (
        <div key={card.id} className={styles.cardRow}>
          <div className={styles.cardRowText}>
            <strong>{kind === "spicy" || kind === "tod" ? (card.prompt === "Dare" ? "😈 Dare" : "🔥 Truth") : card.prompt}</strong>
            <span>{choices ? `${card.a} · ${card.b}` : card.a}</span>
            <small>{card.mine ? "Added by you" : "Added by your partner"}</small>
          </div>
          <button type="button" className={styles.cardRowDelete} onClick={() => void remove(card.id)} aria-label="Delete card">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ReplyMedia({ reply }: { reply: Reply }) {
  if (!reply.mediaUrl) return null;
  const src = mediaUrl(reply.mediaUrl);
  if (reply.mediaType === "image") return <img src={src} alt="" className={styles.replyMedia} />;
  if (reply.mediaType === "video") return <video src={src} className={styles.replyMedia} controls playsInline />;
  return <div className={styles.replyAudio}><VoicePlayer src={src} /></div>;
}

function TruthOrDare({ view, partnerName, socket }: { view: GameView; partnerName: string; socket: ScopedSocket | null }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const sendReply = async (file?: File, kind?: Reply["mediaType"]) => {
    if (sending || (!file && !text.trim())) return;
    setSending(true);
    setError("");
    try {
      const uploaded = file ? await uploadFile(file) : null;
      socket?.emit("game:move", { type: "reply", text: text.trim(), mediaUrl: uploaded?.url || "", mediaType: uploaded ? kind : "" });
      setText("");
    } catch {
      setError("Could not send that. Try a smaller file.");
    } finally {
      setSending(false);
    }
  };

  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void sendReply(file, file.type.startsWith("video/") ? "video" : "image");
  };

  const toggleVoice = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const type = recorder.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        if (chunks.length) void sendReply(new File(chunks, `voice.${ext}`, { type }), "audio");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Allow the microphone to send a voice note.");
    }
  };

  const chooser = view.turnMine ? "You" : partnerName;

  return (
    <div className={styles.play}>
      <p className={styles.round}>Turn {view.round + 1} of {view.total}{view.custom && <span className={styles.customTag}>✍️ Your card</span>}</p>
      {view.waitingPartner && <p className={styles.wait}>Waiting for {partnerName} to open Play.</p>}

      {!view.choice ? (
        view.turnMine ? (
          <div className={styles.todPick}>
            <h2 className={styles.prompt}>Your turn. Truth or dare?</h2>
            <div className={styles.todButtons}>
              <button type="button" className={styles.todTruth} onClick={() => socket?.emit("game:move", { type: "choose", choice: "Truth" })}>
                <span>🤫</span>Truth
              </button>
              <button type="button" className={styles.todDare} onClick={() => socket?.emit("game:move", { type: "choose", choice: "Dare" })}>
                <span>😈</span>Dare
              </button>
            </div>
          </div>
        ) : (
          <p className={styles.wait}>{partnerName} is choosing truth or dare…</p>
        )
      ) : (
        <>
          <article className={`${styles.turnCard} ${view.choice === "Dare" ? styles.todCardDare : styles.todCardTruth}`}>
            <p className={styles.turnLabel}>{chooser} picked {view.choice === "Dare" ? "😈 Dare" : "🤫 Truth"}</p>
            <h2 className={styles.turnText}>{view.a}</h2>
            <p className={styles.turnWho}>{view.turnMine ? "Your move. Answer below." : `${partnerName} answers this one. You can reply too.`}</p>
          </article>

          <div className={styles.answers}>
            {view.myReply && (
              <div className={`${styles.answerBubble} ${styles.answerMine}`}>
                <strong>You</strong>
                <ReplyMedia reply={view.myReply} />
                {view.myReply.text && <p>{view.myReply.text}</p>}
              </div>
            )}
            {view.partnerReply ? (
              <div className={styles.answerBubble}>
                <strong>{partnerName}</strong>
                <ReplyMedia reply={view.partnerReply} />
                {view.partnerReply.text && <p>{view.partnerReply.text}</p>}
              </div>
            ) : (
              !view.turnMine && <p className={styles.wait}>Waiting for {partnerName}&apos;s answer…</p>
            )}
          </div>

          {error && <p className={styles.apart}>{error}</p>}
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickFile} style={{ display: "none" }} />
          <div className={styles.answerBox}>
            <button type="button" className={styles.todAttach} onClick={() => fileRef.current?.click()} disabled={sending || recording} aria-label="Send a photo or video">📷</button>
            <button type="button" className={`${styles.todAttach} ${recording ? styles.todRecording : ""}`} onClick={() => void toggleVoice()} disabled={sending} aria-label={recording ? "Stop and send voice note" : "Record a voice note"}>
              {recording ? "⏹" : "🎤"}
            </button>
            <textarea
              className={styles.answerInput}
              placeholder={recording ? "Recording… tap ⏹ to send" : "Type your answer…"}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={1}
              maxLength={500}
            />
            <button type="button" className={styles.answerSend} onClick={() => void sendReply()} disabled={!text.trim() || sending} aria-label="Send answer">
              {sending ? "…" : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.5l17-8-7 18-2.2-7.2L3 11.5z" /></svg>}
            </button>
          </div>

          <button type="button" className={styles.primary} onClick={() => socket?.emit("game:move", { type: "next" })}>
            Next turn
          </button>
        </>
      )}
    </div>
  );
}
