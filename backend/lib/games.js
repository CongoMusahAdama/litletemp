const SAME = [
  { prompt: "A perfect evening", a: "Movie on the couch", b: "A walk outside" },
  { prompt: "How we eat tonight", a: "Cook together", b: "Order something" },
  { prompt: "The trip we take", a: "Beach", b: "Mountains" },
  { prompt: "Staying close today", a: "Little texts all day", b: "One long call" },
  { prompt: "Our best hour", a: "Early morning", b: "Late at night" },
  { prompt: "A sweet surprise", a: "A note", b: "A plan" },
  { prompt: "This weekend", a: "Stay in", b: "Go out" },
  { prompt: "How we share a moment", a: "A photo", b: "A voice note" },
  { prompt: "Dance in the kitchen", a: "Slow", b: "Silly" },
  { prompt: "Planning us", a: "A real plan", b: "Leave it open" },
];

const KNOW = [
  { prompt: "Their easy Sunday", a: "Sleep in", b: "Get out of the house" },
  { prompt: "When they are upset", a: "Quiet time", b: "A hug first" },
  { prompt: "A gift they love", a: "Something useful", b: "Something sweet" },
  { prompt: "Their kind of song", a: "Soft", b: "Loud" },
  { prompt: "Morning drink", a: "Coffee", b: "Tea" },
  { prompt: "Where they sit", a: "Window seat", b: "Aisle" },
  { prompt: "A note from them", a: "Short and simple", b: "Long and detailed" },
  { prompt: "Their comfort night", a: "Home", b: "Somewhere new" },
];

const TURNS = [
  { prompt: "Notice", a: "Tell them one thing you noticed about them lately." },
  { prompt: "Song", a: "Name the first song that reminds you of them, and why." },
  { prompt: "Photo", a: "Describe your favorite photo of the two of you." },
  { prompt: "This week", a: "Share one small thing from this week you have not told them." },
  { prompt: "Compliment", a: "Compliment something they rarely get complimented for." },
  { prompt: "Hour", a: "Name one hour this week that will belong to the two of you." },
  { prompt: "Question", a: "Ask the question you have been meaning to ask." },
  { prompt: "Firsts", a: "Tell a memory from the beginning of the two of you." },
  { prompt: "More", a: "Say one thing you want more of together." },
  { prompt: "Evening", a: "Describe a perfect evening with them." },
  { prompt: "Thanks", a: "Thank them for one specific thing." },
  { prompt: "Tomorrow", a: "Promise one small thing you will do for them tomorrow." },
];

const sessions = new Map();

function deck(kind) {
  if (kind === "know") return KNOW;
  if (kind === "turn") return TURNS;
  return SAME;
}

function touchPlayer(state, userId) {
  const id = String(userId);
  if (!state.players.includes(id)) state.players.push(id);
}

function startGame(coupleId, kind, userId) {
  const safeKind = kind === "know" || kind === "turn" ? kind : "same";
  const state = {
    kind: safeKind,
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
  sessions.set(String(coupleId), state);
  return state;
}

function currentGame(coupleId) {
  return sessions.get(String(coupleId)) || null;
}

function clearGame(coupleId) {
  sessions.delete(String(coupleId));
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

function moveGame(coupleId, userId, move) {
  const state = currentGame(coupleId);
  if (!state || state.finished) return state;
  touchPlayer(state, userId);
  const id = String(userId);
  if (move?.type === "pick" && state.kind !== "turn" && !state.revealed) {
    const choice = move.choice === "b" ? "b" : "a";
    if (state.kind === "know") {
      if (move.guess !== "a" && move.guess !== "b") return state;
      state.guesses[id] = move.guess;
    }
    state.picks[id] = choice;
    revealIfReady(state);
  }
  if (move?.type === "next") {
    const total = deck(state.kind).length;
    if (state.kind === "turn") {
      state.round += 1;
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
  return state;
}

function viewGame(state, userId) {
  if (!state) return null;
  const me = String(userId);
  const list = deck(state.kind);
  const card = list[Math.min(state.round, list.length - 1)];
  const partnerId = state.players.find((id) => id !== me) || "";
  return {
    kind: state.kind,
    round: Math.min(state.round, list.length),
    total: list.length,
    prompt: card.prompt,
    a: card.a,
    b: card.b || "",
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
