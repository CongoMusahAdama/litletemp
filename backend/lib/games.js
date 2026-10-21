const { DEFAULT_DECKS, KINDS, ROUND_SIZE, TOD_ROUNDS } = require('./gameDecks');
const { bareUpload, publicMedia } = require('./present');
const GameCard = require('../models/GameCard');
const GameState = require('../models/GameState');

// Game state lives only in the database: on Vercel each request may land on a
// different server, so an in-memory copy could go stale between the two phones.
async function persist(coupleId, state) {
  const key = String(coupleId);
  if (!state) {
    await GameState.deleteOne({ coupleId: key });
    return;
  }
  await GameState.findOneAndUpdate(
    { coupleId: key },
    { state },
    { upsert: true }
  );
}

// Games where each player writes an answer instead of picking A or B.
function isWritten(kind) {
  return kind === "turn" || kind === "spicy";
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The couple's own cards come first, then built-in cards fill the round.
async function buildDeck(coupleId, kind) {
  const custom = await GameCard.find({ coupleId, kind }).lean();
  const mine = shuffle(custom).slice(0, ROUND_SIZE).map((card) => ({ prompt: card.prompt, a: card.a, b: card.b || "", custom: true }));
  const fill = shuffle(DEFAULT_DECKS[kind]).slice(0, Math.max(0, ROUND_SIZE - mine.length)).map((card) => ({ ...card, b: card.b || "", custom: false }));
  return shuffle([...mine, ...fill]);
}

// Truth or Dare keeps two piles; the couple's own cards go on top.
async function buildPiles(coupleId) {
  const custom = await GameCard.find({ coupleId, kind: "tod" }).lean();
  const pile = (type) => [
    ...shuffle(custom.filter((card) => card.prompt === type)).map((card) => ({ text: card.a, custom: true })),
    ...shuffle(DEFAULT_DECKS.tod.filter((card) => card.prompt === type)).map((card) => ({ text: card.a, custom: false })),
  ];
  return { Truth: pile("Truth"), Dare: pile("Dare") };
}

function cleanReply(move) {
  const text = String(move.text || "").trim().slice(0, 500);
  const mediaUrl = bareUpload(move.mediaUrl);
  const mediaType = ["image", "video", "audio"].includes(move.mediaType) ? move.mediaType : "";
  if (!text && !mediaUrl) return null;
  return { text, mediaUrl: mediaUrl && mediaType ? mediaUrl : "", mediaType: mediaUrl ? mediaType : "" };
}

function deck(state) {
  return state.cards?.length ? state.cards : DEFAULT_DECKS[state.kind] || DEFAULT_DECKS.same;
}

function touchPlayer(state, userId) {
  const id = String(userId);
  if (!state.players.includes(id)) state.players.push(id);
}

async function startGame(coupleId, kind, userId) {
  const safeKind = KINDS.includes(kind) ? kind : "same";
  const state = {
    kind: safeKind,
    cards: safeKind === "tod" ? [] : await buildDeck(coupleId, safeKind),
    piles: safeKind === "tod" ? await buildPiles(coupleId) : null,
    card: null,
    choice: "",
    replies: {},
    answers: {},
    round: 0,
    picks: {},
    guesses: {},
    matches: 0,
    known: {},
    revealed: false,
    players: [String(userId)],
    turnId: String(userId),
    finished: false,
  };
  await persist(coupleId, state);
  return state;
}

async function currentGame(coupleId) {
  const saved = await GameState.findOne({ coupleId: String(coupleId) }).lean();
  return saved?.state || null;
}

async function clearGame(coupleId) {
  await persist(coupleId, null);
}

function revealIfReady(state) {
  if (state.revealed) return;
  const ids = Object.keys(state.picks);
  if (ids.length < 2) return;
  state.revealed = true;
  const [first, second] = ids;
  if (state.kind === "same" && state.picks[first] === state.picks[second]) {
    state.matches += 1;
  }
  if (state.kind === "know") {
    if (state.guesses[first] && state.guesses[first] === state.picks[second]) {
      state.known[first] = (state.known[first] || 0) + 1;
    }
    if (state.guesses[second] && state.guesses[second] === state.picks[first]) {
      state.known[second] = (state.known[second] || 0) + 1;
    }
  }
}

async function moveGame(coupleId, userId, move) {
  const state = await currentGame(coupleId);
  if (!state || state.finished) return state;
  touchPlayer(state, userId);
  const id = String(userId);
  if (state.kind === "tod") {
    if (move?.type === "choose" && state.turnId === id && !state.card && (move.choice === "Truth" || move.choice === "Dare")) {
      const pile = state.piles?.[move.choice] || [];
      if (!pile.length) {
        // Ran out: reshuffle the built-in cards for this pile.
        DEFAULT_DECKS.tod.filter((card) => card.prompt === move.choice).forEach((card) => pile.push({ text: card.a, custom: false }));
        state.piles[move.choice] = shuffle(pile);
      }
      state.card = state.piles[move.choice].shift();
      state.choice = move.choice;
    }
    if (move?.type === "reply" && state.card) {
      const reply = cleanReply(move);
      if (reply) {
        state.replies = state.replies || {};
        state.replies[id] = reply;
      }
    }
    if (move?.type === "next" && state.card) {
      state.round += 1;
      state.card = null;
      state.choice = "";
      state.replies = {};
      if (state.round >= TOD_ROUNDS) state.finished = true;
      else if (state.players.length > 1) {
        const index = state.players.indexOf(state.turnId);
        state.turnId = state.players[(Math.max(index, 0) + 1) % state.players.length];
      }
    }
    await persist(coupleId, state);
    return state;
  }
  if (move?.type === "answer" && isWritten(state.kind)) {
    const text = String(move.text || "").trim().slice(0, 500);
    if (text) {
      state.answers = state.answers || {};
      state.answers[id] = text;
    }
  }
  if (move?.type === "pick" && !isWritten(state.kind) && !state.revealed) {
    const choice = move.choice === "b" ? "b" : "a";
    if (state.kind === "know") {
      if (move.guess !== "a" && move.guess !== "b") return state;
      state.guesses[id] = move.guess;
    }
    state.picks[id] = choice;
    revealIfReady(state);
  }
  if (move?.type === "next") {
    const total = deck(state).length;
    if (isWritten(state.kind)) {
      state.round += 1;
      state.answers = {};
      if (state.round >= total) state.finished = true;
      else if (state.players.length > 1) {
        const index = state.players.indexOf(state.turnId);
        state.turnId = state.players[(Math.max(index, 0) + 1) % state.players.length];
      }
    } else if (state.revealed) {
      state.round += 1;
      state.picks = {};
      state.guesses = {};
      state.revealed = false;
      if (state.round >= total) state.finished = true;
    }
  }
  await persist(coupleId, state);
  return state;
}

function presentReply(reply) {
  if (!reply) return null;
  return { text: reply.text || "", mediaUrl: reply.mediaUrl ? publicMedia(reply.mediaUrl) : "", mediaType: reply.mediaType || "" };
}

function viewGame(state, userId) {
  if (!state) return null;
  const me = String(userId);
  if (state.kind === "tod") {
    const partner = state.players.find((pid) => pid !== me) || "";
    return {
      kind: "tod",
      round: Math.min(state.round, TOD_ROUNDS),
      total: TOD_ROUNDS,
      prompt: state.choice || "",
      a: state.card?.text || "",
      b: "",
      custom: Boolean(state.card?.custom),
      choice: state.choice || "",
      myReply: presentReply(state.replies?.[me]),
      partnerReply: partner ? presentReply(state.replies?.[partner]) : null,
      myAnswer: "",
      partnerAnswer: "",
      mine: "",
      myGuess: "",
      partnerPick: "",
      partnerGuess: "",
      partnerLocked: false,
      iLocked: false,
      revealed: false,
      matches: 0,
      myKnown: 0,
      partnerKnown: 0,
      turnMine: state.turnId === me,
      finished: state.finished,
      waitingPartner: state.players.length < 2,
    };
  }
  const list = deck(state);
  const card = list[Math.min(state.round, list.length - 1)];
  const partnerId = state.players.find((id) => id !== me) || "";
  return {
    kind: state.kind,
    round: Math.min(state.round, list.length),
    total: list.length,
    prompt: card.prompt,
    a: card.a,
    b: card.b || "",
    custom: Boolean(card.custom),
    myAnswer: state.answers?.[me] || "",
    partnerAnswer: partnerId ? (state.answers?.[partnerId] || "") : "",
    mine: state.picks[me] || "",
    myGuess: state.guesses[me] || "",
    partnerPick: state.revealed ? (state.picks[partnerId] || "") : "",
    partnerGuess: state.revealed ? (state.guesses[partnerId] || "") : "",
    partnerLocked: Boolean(partnerId && state.picks[partnerId]),
    iLocked: Boolean(state.picks[me]),
    revealed: state.revealed,
    matches: state.matches,
    myKnown: state.known[me] || 0,
    partnerKnown: partnerId ? (state.known[partnerId] || 0) : 0,
    turnMine: state.turnId === me,
    finished: state.finished,
    waitingPartner: state.players.length < 2,
  };
}

module.exports = { startGame, currentGame, clearGame, moveGame, viewGame, touchPlayer };
