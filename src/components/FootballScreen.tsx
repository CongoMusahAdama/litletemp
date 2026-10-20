"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FootballScreen.module.css";
import { api, shownName } from "@/lib/api";
import { scopedSocket } from "@/lib/socket";
import { useSession } from "@/context/SessionContext";
import { clockTime, dayLabel } from "@/lib/chatDates";

type Side = { id: string; name: string; short: string; logo: string; score: number | null };
type Match = {
  id: string;
  league: string;
  leagueName: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished" | "off";
  detail: string;
  clock: string;
  home: Side;
  away: Side;
};
type Team = { id: string; name: string; short: string; logo: string; league: string; leagueName: string };
type Pick = { homeGoals: number | null; awayGoals: number | null; prize: string };
type Bet = {
  id: string;
  matchId: string;
  match: { leagueName: string; kickoff: string; home: { id: string; name: string; logo: string }; away: { id: string; name: string; logo: string } };
  status: "open" | "settled" | "void";
  result: { homeScore: number; awayScore: number; reason: string } | null;
  mine: Pick | null;
  theirs: Pick | null;
  outcome: "won" | "lost" | "tie" | null;
  paid: boolean;
  locked: boolean;
};

const PRIZES = ["🎁 A gift of my choice", "💆 A 20-minute massage", "🍕 Dinner on you", "😈 A dare of my choice", "💋 10 kisses", "🎬 I pick the movie"];
const FILTERS = [
  { id: "all", label: "All" },
  { id: "ours", label: "Our teams" },
  { id: "eng.1", label: "Premier League" },
  { id: "esp.1", label: "LaLiga" },
] as const;

function Crest({ src, name, size = 34 }: { src?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken
    ? <img src={src} alt={name} width={size} height={size} className={styles.crest} loading="lazy" onError={() => setBroken(true)} />
    : <span className={styles.crestBlank} style={{ width: size, height: size }}>{name.slice(0, 1)}</span>;
}

function outcomeText(home: string, away: string, h: number, a: number) {
  if (h > a) return `${home} win`;
  if (a > h) return `${away} win`;
  return "Draw";
}

export default function FootballScreen({ onBack }: { onBack: () => void }) {
  const { user, partner, refresh } = useSession();
  const partnerName = shownName(partner, "Your partner");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [tab, setTab] = useState<"matches" | "bets">("matches");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [betting, setBetting] = useState<Match | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const myTeam = user?.favoriteTeam || null;
  const theirTeam = partner?.favoriteTeam || null;

  const loadBets = useCallback(() => {
    api<Bet[]>("/api/football/bets").then(setBets).catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadMatches = () => api<Match[]>("/api/football/matches")
      .then((rows) => { setMatches(rows); setError(""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load matches"));
    loadMatches();
    loadBets();
    // Live scores move; refresh every minute while this screen is open.
    const timer = window.setInterval(loadMatches, 60000);
    const socket = scopedSocket();
    socket.on("bet:changed", loadBets);
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [loadBets]);

  const betByMatch = useMemo(() => new Map(bets.map((bet) => [bet.matchId, bet])), [bets]);
  const involves = (match: Match, team: { id: string } | null) => Boolean(team && (match.home.id === team.id || match.away.id === team.id));

  const visible = (matches || []).filter((match) => {
    if (filter === "ours") return involves(match, myTeam) || involves(match, theirTeam);
    if (filter === "eng.1" || filter === "esp.1") return match.league === filter;
    return true;
  });
  // Live first, then upcoming, then recent results.
  const ordered = [
    ...visible.filter((match) => match.status === "live"),
    ...visible.filter((match) => match.status === "scheduled"),
    ...visible.filter((match) => match.status === "finished" || match.status === "off").reverse(),
  ];
  const groups: { label: string; items: Match[] }[] = [];
  ordered.forEach((match) => {
    const label = match.status === "live" ? "Live now" : match.status === "scheduled" ? dayLabel(match.kickoff) : "Recent results";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(match);
    else groups.push({ label, items: [match] });
  });

  const needsMe = bets.filter((bet) => bet.status === "open" && !bet.locked && bet.theirs && !bet.mine).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className={styles.title}>Match bets ⚽</h1>
      </header>

      <div className={styles.teams}>
        <button type="button" className={styles.teamCard} onClick={() => setPicking(true)}>
          {myTeam ? <Crest src={myTeam.logo} name={myTeam.name} size={38} /> : <span className={styles.teamPlus}>+</span>}
          <span className={styles.teamText}>
            <small>You support</small>
            <strong>{myTeam?.name || "Pick your team"}</strong>
          </span>
        </button>
        <div className={styles.teamCard}>
          {theirTeam ? <Crest src={theirTeam.logo} name={theirTeam.name} size={38} /> : <span className={styles.teamPlus}>?</span>}
          <span className={styles.teamText}>
            <small>{partnerName} supports</small>
            <strong>{theirTeam?.name || "Not picked yet"}</strong>
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={tab === "matches" ? styles.tabOn : ""} onClick={() => setTab("matches")}>Matches</button>
        <button type="button" className={tab === "bets" ? styles.tabOn : ""} onClick={() => setTab("bets")}>
          Our bets{needsMe > 0 && <em className={styles.badge}>{needsMe}</em>}
        </button>
      </div>

      <div className={styles.body}>
        {tab === "matches" && (
          <>
            <div className={styles.filters}>
              {FILTERS.map((item) => (
                <button key={item.id} type="button" className={filter === item.id ? styles.filterOn : ""} onClick={() => setFilter(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            {error && <p className={styles.note}>{error}</p>}
            {matches === null && !error && <p className={styles.note}>Loading fixtures…</p>}
            {matches && groups.length === 0 && (
              <p className={styles.note}>{filter === "ours" ? "None of your teams play in the next three weeks." : "No matches in this window."}</p>
            )}
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className={`${styles.day} ${group.label === "Live now" ? styles.dayLive : ""}`}>{group.label}</h3>
                {group.items.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    bet={betByMatch.get(match.id)}
                    mine={involves(match, myTeam) ? (match.home.id === myTeam?.id ? "home" : "away") : null}
                    theirs={involves(match, theirTeam) ? (match.home.id === theirTeam?.id ? "home" : "away") : null}
                    partnerName={partnerName}
                    onBet={() => setBetting(match)}
                  />
                ))}
              </section>
            ))}
          </>
        )}

        {tab === "bets" && (
          <>
            {bets.length === 0 && <p className={styles.note}>No bets yet. Pick a match and challenge {partnerName}! 🎯</p>}
            {bets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                live={(matches || []).find((match) => match.id === bet.matchId)}
                partnerName={partnerName}
                onOpen={() => {
                  const match = (matches || []).find((item) => item.id === bet.matchId);
                  if (match && match.status === "scheduled") setBetting(match);
                }}
                onPaid={() => api(`/api/football/bets/${bet.id}/paid`, { method: "POST", body: JSON.stringify({ paid: !bet.paid }) }).then(loadBets).catch(() => undefined)}
              />
            ))}
          </>
        )}
      </div>

      {betting && (
        <BetSheet
          match={betting}
          bet={betByMatch.get(betting.id)}
          myTeamId={myTeam?.id}
          theirTeamId={theirTeam?.id}
          partnerName={partnerName}
          onClose={() => setBetting(null)}
          onSaved={() => { setBetting(null); loadBets(); setTab("bets"); }}
        />
      )}

      {picking && (
        <TeamPicker
          current={myTeam?.id}
          onClose={() => setPicking(false)}
          onPicked={() => { setPicking(false); refresh().catch(() => undefined); }}
        />
      )}
    </div>
  );
}

function MatchCard({ match, bet, mine, theirs, partnerName, onBet }: {
  match: Match;
  bet?: Bet;
  mine: "home" | "away" | null;
  theirs: "home" | "away" | null;
  partnerName: string;
  onBet: () => void;
}) {
  const started = match.status !== "scheduled";
  const tag = (sideKey: "home" | "away") => (
    <>
      {mine === sideKey && <em className={styles.tagMine}>You</em>}
      {theirs === sideKey && <em className={styles.tagTheirs}>{partnerName}</em>}
    </>
  );
  return (
    <div className={`${styles.match} ${mine || theirs ? styles.matchOurs : ""}`}>
      <div className={styles.matchTop}>
        <span className={styles.league}>{match.leagueName}</span>
        {match.status === "live" ? (
          <span className={styles.live}><i />LIVE {match.clock || match.detail}</span>
        ) : match.status === "finished" ? (
          <span className={styles.ft}>Full time</span>
        ) : match.status === "off" ? (
          <span className={styles.ft}>{match.detail || "Postponed"}</span>
        ) : (
          <span className={styles.ft}>{clockTime(match.kickoff)}</span>
        )}
      </div>
      <div className={styles.matchRow}>
        <div className={styles.side}>
          <Crest src={match.home.logo} name={match.home.name} />
          <span className={styles.sideName}>{match.home.short}</span>
          {tag("home")}
        </div>
        <div className={styles.score}>
          {started && match.status !== "off" ? `${match.home.score ?? 0} – ${match.away.score ?? 0}` : "vs"}
        </div>
        <div className={`${styles.side} ${styles.sideAway}`}>
          <Crest src={match.away.logo} name={match.away.name} />
          <span className={styles.sideName}>{match.away.short}</span>
          {tag("away")}
        </div>
      </div>
      <div className={styles.matchFoot}>
        {bet?.mine ? (
          <button type="button" className={styles.betDone} onClick={started ? undefined : onBet} disabled={started}>
            🎯 You: {bet.mine.homeGoals}–{bet.mine.awayGoals}
            {bet.theirs ? " · both in 🔒" : ` · waiting for ${partnerName}`}
          </button>
        ) : !started ? (
          <button type="button" className={styles.betBtn} onClick={onBet}>
            {bet?.theirs ? `⚡ ${partnerName} bet on this. Take them on` : "Place a bet"}
          </button>
        ) : (
          <span className={styles.betClosed}>{bet?.theirs ? `${partnerName} bet alone on this one` : "Betting closed"}</span>
        )}
      </div>
    </div>
  );
}

function BetCard({ bet, live, partnerName, onOpen, onPaid }: { bet: Bet; live?: Match; partnerName: string; onOpen: () => void; onPaid: () => void }) {
  const score = bet.result
    ? `${bet.result.homeScore} – ${bet.result.awayScore}`
    : live && live.status !== "scheduled" ? `${live.home.score ?? 0} – ${live.away.score ?? 0}` : "vs";
  const state = bet.status === "void" ? (bet.result?.reason || "Called off")
    : bet.status === "settled" ? (bet.outcome === "won" ? "🏆 You won!" : bet.outcome === "lost" ? "😅 You lost" : "🤝 It's a tie")
    : live?.status === "live" ? `🔴 Live ${live.clock}`
    : bet.locked ? "🔒 Locked in, kicking off"
    : !bet.mine ? `${partnerName} is waiting for you`
    : !bet.theirs ? `Waiting for ${partnerName}`
    : "🔒 Both in. Picks reveal at kickoff";
  const owes = bet.status === "settled" && bet.outcome === "won" ? `${partnerName} owes you: ${bet.mine?.prize}`
    : bet.status === "settled" && bet.outcome === "lost" ? `You owe ${partnerName}: ${bet.theirs?.prize}`
    : "";
  return (
    <div className={`${styles.betCard} ${bet.outcome === "won" ? styles.betWon : bet.outcome === "lost" ? styles.betLost : ""}`} onClick={onOpen}>
      <div className={styles.betHead}>
        <span className={styles.league}>{bet.match.leagueName} · {dayLabel(bet.match.kickoff)} {clockTime(bet.match.kickoff)}</span>
        <span className={styles.betState}>{state}</span>
      </div>
      <div className={styles.matchRow}>
        <div className={styles.side}><Crest src={bet.match.home.logo} name={bet.match.home.name} size={30} /><span className={styles.sideName}>{bet.match.home.name}</span></div>
        <div className={styles.score}>{score}</div>
        <div className={`${styles.side} ${styles.sideAway}`}><Crest src={bet.match.away.logo} name={bet.match.away.name} size={30} /><span className={styles.sideName}>{bet.match.away.name}</span></div>
      </div>
      <div className={styles.picks}>
        <div><small>You</small><strong>{bet.mine ? `${bet.mine.homeGoals}–${bet.mine.awayGoals}` : "—"}</strong><span>{bet.mine?.prize || "No bet yet"}</span></div>
        <div><small>{partnerName}</small><strong>{bet.theirs ? (bet.theirs.homeGoals === null ? "🔒" : `${bet.theirs.homeGoals}–${bet.theirs.awayGoals}`) : "—"}</strong><span>{bet.theirs?.prize || "No bet yet"}</span></div>
      </div>
      {owes && (
        <div className={styles.owes} onClick={(event) => event.stopPropagation()}>
          <span>{owes}</span>
          {bet.outcome === "won" && (
            <button type="button" className={bet.paid ? styles.paidOn : styles.paidBtn} onClick={onPaid}>
              {bet.paid ? "✓ Received" : "Mark received"}
            </button>
          )}
          {bet.outcome === "lost" && bet.paid && <em className={styles.paidTag}>✓ Paid</em>}
        </div>
      )}
      {bet.result?.reason && bet.status === "settled" && <p className={styles.reason}>{bet.result.reason}</p>}
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  return (
    <div className={styles.stepper}>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} aria-label={`More goals for ${label}`}>+</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Fewer goals for ${label}`}>−</button>
    </div>
  );
}

function BetSheet({ match, bet, myTeamId, theirTeamId, partnerName, onClose, onSaved }: {
  match: Match;
  bet?: Bet;
  myTeamId?: string;
  theirTeamId?: string;
  partnerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Start from your existing bet, else back your own team, else bet against theirs.
  const start = (() => {
    if (bet?.mine && bet.mine.homeGoals !== null && bet.mine.awayGoals !== null) return [bet.mine.homeGoals, bet.mine.awayGoals];
    if (myTeamId === match.home.id) return [2, 1];
    if (myTeamId === match.away.id) return [1, 2];
    if (theirTeamId === match.home.id) return [1, 2];
    if (theirTeamId === match.away.id) return [2, 1];
    return [1, 1];
  })();
  const [home, setHome] = useState(start[0]);
  const [away, setAway] = useState(start[1]);
  const [prize, setPrize] = useState(bet?.mine?.prize || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!prize.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/football/bets", { method: "POST", body: JSON.stringify({ matchId: match.id, homeGoals: home, awayGoals: away, prize: prize.trim() }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the bet");
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!bet) return;
    await api(`/api/football/bets/${bet.id}/mine`, { method: "DELETE" }).catch(() => undefined);
    onSaved();
  };

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.grip} />
        <p className={styles.sheetLeague}>{match.leagueName} · {dayLabel(match.kickoff)} {clockTime(match.kickoff)}</p>
        <h2 className={styles.sheetTitle}>Predict the score</h2>

        <div className={styles.predict}>
          <div className={styles.predictSide}>
            <Crest src={match.home.logo} name={match.home.name} size={48} />
            <span>{match.home.short}</span>
            {myTeamId === match.home.id && <em className={styles.tagMine}>Your team</em>}
            {theirTeamId === match.home.id && <em className={styles.tagTheirs}>{partnerName}</em>}
          </div>
          <Stepper value={home} onChange={setHome} label={match.home.name} />
          <span className={styles.dash}>–</span>
          <Stepper value={away} onChange={setAway} label={match.away.name} />
          <div className={styles.predictSide}>
            <Crest src={match.away.logo} name={match.away.name} size={48} />
            <span>{match.away.short}</span>
            {myTeamId === match.away.id && <em className={styles.tagMine}>Your team</em>}
            {theirTeamId === match.away.id && <em className={styles.tagTheirs}>{partnerName}</em>}
          </div>
        </div>
        <p className={styles.outcome}>{outcomeText(match.home.short, match.away.short, home, away)}</p>

        <label className={styles.prizeLabel} htmlFor="bet-prize">If you win, {partnerName} owes you…</label>
        <input
          id="bet-prize"
          className={styles.prizeInput}
          placeholder="A gift, a dare, a date…"
          value={prize}
          onChange={(event) => setPrize(event.target.value)}
          maxLength={200}
        />
        <div className={styles.prizeChips}>
          {PRIZES.map((item) => (
            <button key={item} type="button" className={prize === item ? styles.chipOn : ""} onClick={() => setPrize(item)}>{item}</button>
          ))}
        </div>

        {bet?.theirs && (
          <p className={styles.theirBet}>
            ⚡ {partnerName} already bet. If they win, you owe them: <strong>{bet.theirs.prize}</strong>. Their score stays hidden until kickoff.
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.lockBtn} onClick={() => void save()} disabled={!prize.trim() || saving}>
          {saving ? "Locking in…" : bet?.mine ? "Update my bet" : "Lock in my bet 🎯"}
        </button>
        {bet?.mine && <button type="button" className={styles.withdraw} onClick={() => void withdraw()}>Take my bet back</button>}
        <p className={styles.rules}>Exact score wins. Otherwise the right result wins, then the closest score. No money, just love. 💗</p>
      </div>
    </div>,
    document.body,
  );
}

function TeamPicker({ current, onClose, onPicked }: { current?: string; onClose: () => void; onPicked: () => void }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    api<Team[]>("/api/football/teams").then(setTeams).catch(() => setTeams([]));
  }, []);

  const choose = async (team: Team) => {
    setSaving(team.id);
    try {
      await api("/api/football/team", { method: "PUT", body: JSON.stringify({ teamId: team.id }) });
      onPicked();
    } catch {
      setSaving("");
    }
  };

  const shown = (teams || []).filter((team) => team.name.toLowerCase().includes(query.trim().toLowerCase()));
  const leagues = [...new Set(shown.map((team) => team.leagueName))];

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.grip} />
        <h2 className={styles.sheetTitle}>Who do you support?</h2>
        <input className={styles.prizeInput} placeholder="Search teams" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
        {teams === null && <p className={styles.note}>Loading teams…</p>}
        {leagues.map((league) => (
          <section key={league}>
            <h3 className={styles.day}>{league}</h3>
            <div className={styles.teamGrid}>
              {shown.filter((team) => team.leagueName === league).map((team) => (
                <button key={team.id} type="button" className={`${styles.teamOption} ${current === team.id ? styles.teamOptionOn : ""}`} onClick={() => void choose(team)} disabled={!!saving}>
                  <Crest src={team.logo} name={team.name} size={36} />
                  <span>{saving === team.id ? "Saving…" : team.short}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
