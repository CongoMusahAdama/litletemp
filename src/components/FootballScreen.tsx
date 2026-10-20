"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FootballScreen.module.css";
import { api, mediaUrl, shownName } from "@/lib/api";
import { scopedSocket } from "@/lib/socket";
import { useSession } from "@/context/SessionContext";
import { clockTime, dayLabel } from "@/lib/chatDates";

type Side = { id: string; name: string; short: string; logo: string; score: number | null };
type Match = {
  id: string;
  league: string;
  leagueName: string;
  leagueLogo: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished" | "off";
  detail: string;
  clock: string;
  home: Side;
  away: Side;
};
type Team = { id: string; name: string; short: string; logo: string; league: string; leagueName: string; leagueLogo: string };
type Pick = { homeGoals: number | null; awayGoals: number | null; prize: string };
type Bet = {
  id: string;
  matchId: string;
  match: { leagueName: string; leagueLogo?: string; kickoff: string; home: { id: string; name: string; logo: string }; away: { id: string; name: string; logo: string } };
  status: "open" | "settled" | "void";
  result: { homeScore: number; awayScore: number; reason: string } | null;
  mine: Pick | null;
  theirs: Pick | null;
  outcome: "won" | "lost" | "tie" | null;
  paid: boolean;
  locked: boolean;
};

const PRIZES = ["🎁 A gift of my choice", "💆 A 20-minute massage", "🍕 Dinner on you", "😈 A dare of my choice", "💋 10 kisses", "🎬 I pick the movie", "☕ Breakfast in bed"];
const COMPETITIONS = [
  { id: "eng.1", label: "Premier League" },
  { id: "esp.1", label: "LaLiga" },
  { id: "uefa.champions", label: "Champions League" },
];

function Crest({ src, name, size = 34 }: { src?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return src && !broken
    ? <img src={src} alt={name} width={size} height={size} className={styles.crest} loading="lazy" onError={() => setBroken(true)} />
    : <span className={styles.crestBlank} style={{ width: size, height: size }}>{name.slice(0, 1)}</span>;
}

function outcomeText(home: string, away: string, h: number, a: number) {
  if (h > a) return `${home} win`;
  if (a > h) return `${away} win`;
  return "A draw";
}

export default function FootballScreen({ onBack }: { onBack: () => void }) {
  const { user, partner, refresh } = useSession();
  const partnerName = shownName(partner, "Your partner");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [tab, setTab] = useState<"matches" | "bets">("matches");
  const [filter, setFilter] = useState("all");
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
  const leagueLogos = useMemo(() => new Map((matches || []).map((match) => [match.league, match.leagueLogo])), [matches]);
  const involves = (match: Match, team: { id: string } | null) => Boolean(team && (match.home.id === team.id || match.away.id === team.id));

  const record = {
    won: bets.filter((bet) => bet.outcome === "won").length,
    lost: bets.filter((bet) => bet.outcome === "lost").length,
    tied: bets.filter((bet) => bet.outcome === "tie").length,
  };
  const toCollect = bets.filter((bet) => bet.outcome === "won" && !bet.paid).length;
  const openBets = bets.filter((bet) => bet.status === "open").length;
  const needsMe = bets.filter((bet) => bet.status === "open" && !bet.locked && bet.theirs && !bet.mine).length;

  const visible = (matches || []).filter((match) => {
    if (filter === "ours") return involves(match, myTeam) || involves(match, theirTeam);
    if (filter !== "all") return match.league === filter;
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

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.pitchLines} aria-hidden="true" />
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={onBack} aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className={styles.title}>Match bets</h1>
          <span className={styles.headerSpacer} />
        </header>

        <div className={styles.rivalry}>
          <button type="button" className={styles.fan} onClick={() => setPicking(true)} aria-label="Change your team">
            <span className={styles.fanCrest}>
              {myTeam ? <Crest src={myTeam.logo} name={myTeam.name} size={46} /> : <span className={styles.fanPlus}>+</span>}
              {user?.avatarUrl && <img className={styles.fanFace} src={mediaUrl(user.avatarUrl)} alt="" />}
            </span>
            <strong>You</strong>
            <small>{myTeam?.name || "Pick your team"}</small>
          </button>

          <div className={styles.record}>
            <span className={styles.recordScore}>{record.won}<i>–</i>{record.lost}</span>
            <small>{record.tied ? `${record.tied} tie${record.tied === 1 ? "" : "s"}` : "head to head"}</small>
          </div>

          <div className={styles.fan}>
            <span className={styles.fanCrest}>
              {theirTeam ? <Crest src={theirTeam.logo} name={theirTeam.name} size={46} /> : <span className={styles.fanPlus}>?</span>}
              {partner?.avatarUrl && <img className={styles.fanFace} src={mediaUrl(partner.avatarUrl)} alt="" />}
            </span>
            <strong>{partnerName}</strong>
            <small>{theirTeam?.name || "No team yet"}</small>
          </div>
        </div>

        <div className={styles.heroChips}>
          <span>🎯 {openBets} open bet{openBets === 1 ? "" : "s"}</span>
          {toCollect > 0 && <span className={styles.heroChipHot}>🎁 {toCollect} prize{toCollect === 1 ? "" : "s"} to collect</span>}
        </div>
      </section>

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
              <button type="button" className={filter === "all" ? styles.filterOn : ""} onClick={() => setFilter("all")}>All</button>
              <button type="button" className={filter === "ours" ? styles.filterOn : ""} onClick={() => setFilter("ours")}>⭐ Our teams</button>
              {COMPETITIONS.map((item) => (
                <button key={item.id} type="button" className={filter === item.id ? styles.filterOn : ""} onClick={() => setFilter(item.id)}>
                  {leagueLogos.get(item.id) && <img src={leagueLogos.get(item.id)} alt="" width={18} height={18} />}
                  {item.label}
                </button>
              ))}
            </div>
            {error && <p className={styles.note}>{error}</p>}
            {matches === null && !error && (
              <div className={styles.skeletons}>{[0, 1, 2].map((i) => <div key={i} className={styles.skeleton} />)}</div>
            )}
            {matches && groups.length === 0 && (
              <p className={styles.note}>{filter === "ours" ? "None of your teams play in the next three weeks." : "No matches in this window."}</p>
            )}
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className={`${styles.day} ${group.label === "Live now" ? styles.dayLive : ""}`}><span>{group.label}</span></h3>
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
            {bets.length === 0 && (
              <div className={styles.empty}>
                <span>🎯</span>
                <p>No bets yet. Pick a match and challenge {partnerName}!</p>
                <button type="button" className={styles.emptyBtn} onClick={() => setTab("matches")}>See matches</button>
              </div>
            )}
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
  const accent = mine && theirs ? styles.matchDerby : mine ? styles.matchMine : theirs ? styles.matchTheirs : "";
  const tag = (sideKey: "home" | "away") => (
    <span className={styles.tags}>
      {mine === sideKey && <em className={styles.tagMine}>You</em>}
      {theirs === sideKey && <em className={styles.tagTheirs}>{partnerName}</em>}
    </span>
  );
  return (
    <div className={`${styles.match} ${accent} ${match.status === "live" ? styles.matchLive : ""}`}>
      <div className={styles.matchTop}>
        <span className={styles.league}>
          {match.leagueLogo && <img src={match.leagueLogo} alt="" width={16} height={16} />}
          {match.leagueName}
        </span>
        {mine && theirs && <span className={styles.derby}>🔥 Your derby</span>}
      </div>
      <div className={styles.matchRow}>
        <div className={styles.side}>
          <span className={styles.disc}><Crest src={match.home.logo} name={match.home.name} size={38} /></span>
          <span className={styles.sideName}>{match.home.short}</span>
          {tag("home")}
        </div>
        <div className={styles.center}>
          {match.status === "live" ? (
            <>
              <span className={styles.scoreLive}>{match.home.score ?? 0}<i>:</i>{match.away.score ?? 0}</span>
              <span className={styles.livePill}><b />{match.clock || "LIVE"}</span>
            </>
          ) : match.status === "finished" ? (
            <>
              <span className={styles.scoreBig}>{match.home.score ?? 0}<i>:</i>{match.away.score ?? 0}</span>
              <span className={styles.centerSub}>Full time</span>
            </>
          ) : match.status === "off" ? (
            <span className={styles.centerSub}>{match.detail || "Postponed"}</span>
          ) : (
            <>
              <span className={styles.kickoff}>{clockTime(match.kickoff)}</span>
              <span className={styles.centerSub}>{dayLabel(match.kickoff)}</span>
            </>
          )}
        </div>
        <div className={styles.side}>
          <span className={styles.disc}><Crest src={match.away.logo} name={match.away.name} size={38} /></span>
          <span className={styles.sideName}>{match.away.short}</span>
          {tag("away")}
        </div>
      </div>
      <div className={styles.matchFoot}>
        {bet?.mine ? (
          <button type="button" className={styles.betDone} onClick={started ? undefined : onBet} disabled={started}>
            <span>🎯 You said <b>{bet.mine.homeGoals}–{bet.mine.awayGoals}</b></span>
            <span className={styles.betDoneState}>{bet.theirs ? "Both in 🔒" : `Waiting for ${partnerName}`}</span>
          </button>
        ) : !started ? (
          <button type="button" className={`${styles.betBtn} ${bet?.theirs ? styles.betBtnHot : ""}`} onClick={onBet}>
            {bet?.theirs ? `⚡ ${partnerName} bet on this. Take them on!` : "Place a bet"}
          </button>
        ) : (
          <span className={styles.betClosed}>{bet?.theirs ? `${partnerName} bet alone on this one` : "Betting closed at kickoff"}</span>
        )}
      </div>
    </div>
  );
}

function BetCard({ bet, live, partnerName, onOpen, onPaid }: { bet: Bet; live?: Match; partnerName: string; onOpen: () => void; onPaid: () => void }) {
  const isLive = live?.status === "live";
  const score = bet.result
    ? `${bet.result.homeScore} : ${bet.result.awayScore}`
    : live && live.status !== "scheduled" ? `${live.home.score ?? 0} : ${live.away.score ?? 0}` : clockTime(bet.match.kickoff);
  const ribbon = bet.status === "void" ? { text: "VOID", cls: styles.ribbonVoid }
    : bet.outcome === "won" ? { text: "YOU WON", cls: styles.ribbonWon }
    : bet.outcome === "lost" ? { text: "YOU LOST", cls: styles.ribbonLost }
    : bet.outcome === "tie" ? { text: "TIE", cls: styles.ribbonVoid }
    : isLive ? { text: "LIVE", cls: styles.ribbonLive }
    : null;
  const state = bet.status === "void" ? (bet.result?.reason || "Called off")
    : bet.status === "settled" ? (bet.result?.reason || "")
    : bet.locked ? "Locked in. Picks revealed"
    : !bet.mine ? `${partnerName} is waiting for you`
    : !bet.theirs ? `Waiting for ${partnerName}`
    : "Both in. Picks reveal at kickoff";
  const owes = bet.status === "settled" && bet.outcome === "won" ? `${partnerName} owes you` : bet.status === "settled" && bet.outcome === "lost" ? `You owe ${partnerName}` : "";
  const prize = bet.outcome === "won" ? bet.mine?.prize : bet.theirs?.prize;
  return (
    <div className={`${styles.ticket} ${bet.outcome === "won" ? styles.ticketWon : bet.outcome === "lost" ? styles.ticketLost : ""}`} onClick={onOpen}>
      {ribbon && <span className={`${styles.ribbon} ${ribbon.cls}`}>{ribbon.text}</span>}
      <div className={styles.ticketTop}>
        <span className={styles.league}>
          {bet.match.leagueLogo && <img src={bet.match.leagueLogo} alt="" width={16} height={16} />}
          {bet.match.leagueName} · {dayLabel(bet.match.kickoff)}
        </span>
        <div className={styles.matchRow}>
          <div className={styles.side}><span className={styles.disc}><Crest src={bet.match.home.logo} name={bet.match.home.name} size={32} /></span><span className={styles.sideName}>{bet.match.home.name}</span></div>
          <div className={styles.center}><span className={isLive ? styles.scoreLive : styles.scoreBig}>{score}</span></div>
          <div className={styles.side}><span className={styles.disc}><Crest src={bet.match.away.logo} name={bet.match.away.name} size={32} /></span><span className={styles.sideName}>{bet.match.away.name}</span></div>
        </div>
        <p className={styles.ticketState}>{state}</p>
      </div>
      <div className={styles.perforation} aria-hidden="true" />
      <div className={styles.ticketPicks}>
        <div className={bet.outcome === "won" ? styles.pickWin : ""}>
          <small>You</small>
          <strong>{bet.mine ? `${bet.mine.homeGoals} – ${bet.mine.awayGoals}` : "—"}</strong>
          <span>{bet.mine?.prize || "No bet yet"}</span>
        </div>
        <div className={bet.outcome === "lost" ? styles.pickWin : ""}>
          <small>{partnerName}</small>
          <strong>{bet.theirs ? (bet.theirs.homeGoals === null ? "🔒" : `${bet.theirs.homeGoals} – ${bet.theirs.awayGoals}`) : "—"}</strong>
          <span>{bet.theirs?.prize || "No bet yet"}</span>
        </div>
      </div>
      {owes && (
        <div className={styles.owes} onClick={(event) => event.stopPropagation()}>
          <span><small>{owes}</small>{prize || "a surprise"}</span>
          {bet.outcome === "won" && (
            <button type="button" className={bet.paid ? styles.paidOn : styles.paidBtn} onClick={onPaid}>
              {bet.paid ? "✓ Received" : "Mark received"}
            </button>
          )}
          {bet.outcome === "lost" && bet.paid && <em className={styles.paidTag}>✓ Paid</em>}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  return (
    <div className={styles.stepper}>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} aria-label={`More goals for ${label}`}>+</button>
      <span className={styles.digit} key={value}>{value}</span>
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

  const sideTag = (id: string) => (
    <>
      {myTeamId === id && <em className={styles.tagMine}>Your team</em>}
      {theirTeamId === id && <em className={styles.tagTheirs}>{partnerName}</em>}
    </>
  );

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.sheetHero}>
          <div className={styles.pitchLines} aria-hidden="true" />
          <div className={styles.grip} />
          <p className={styles.sheetLeague}>
            {match.leagueLogo && <img src={match.leagueLogo} alt="" width={16} height={16} />}
            {match.leagueName} · {dayLabel(match.kickoff)} {clockTime(match.kickoff)}
          </p>
          <div className={styles.predict}>
            <div className={styles.predictSide}>
              <span className={styles.discBig}><Crest src={match.home.logo} name={match.home.name} size={52} /></span>
              <span>{match.home.short}</span>
              {sideTag(match.home.id)}
            </div>
            <div className={styles.board}>
              <Stepper value={home} onChange={setHome} label={match.home.name} />
              <span className={styles.boardColon}>:</span>
              <Stepper value={away} onChange={setAway} label={match.away.name} />
            </div>
            <div className={styles.predictSide}>
              <span className={styles.discBig}><Crest src={match.away.logo} name={match.away.name} size={52} /></span>
              <span>{match.away.short}</span>
              {sideTag(match.away.id)}
            </div>
          </div>
          <p className={styles.outcome}>Your call: {outcomeText(match.home.short, match.away.short, home, away)}</p>
        </div>

        <div className={styles.sheetBody}>
          <label className={styles.prizeLabel} htmlFor="bet-prize">🎁 If you win, {partnerName} owes you…</label>
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
              ⚡ {partnerName} already bet. If they win, you owe them <strong>{bet.theirs.prize}</strong>. Their score stays secret until kickoff.
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          <button type="button" className={styles.lockBtn} onClick={() => void save()} disabled={!prize.trim() || saving}>
            {saving ? "Locking in…" : bet?.mine ? "Update my bet" : "Lock in my bet 🎯"}
          </button>
          {bet?.mine && <button type="button" className={styles.withdraw} onClick={() => void withdraw()}>Take my bet back</button>}
          <p className={styles.rules}>Exact score wins · then the right result · then the closest score. No money, just love 💗</p>
        </div>
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
  const leagues = COMPETITIONS.map((item) => ({
    ...item,
    logo: shown.find((team) => team.league === item.id)?.leagueLogo,
    teams: shown.filter((team) => team.league === item.id),
  })).filter((league) => league.teams.length);

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div className={`${styles.sheet} ${styles.sheetPlain}`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.grip} />
        <h2 className={styles.sheetTitle}>Who do you support?</h2>
        <input className={styles.prizeInput} placeholder="🔍 Search clubs" value={query} onChange={(event) => setQuery(event.target.value)} />
        {teams === null && <div className={styles.skeletons}>{[0, 1].map((i) => <div key={i} className={styles.skeleton} />)}</div>}
        {leagues.map((league) => (
          <section key={league.id}>
            <h3 className={styles.pickerLeague}>
              {league.logo && <img src={league.logo} alt="" width={20} height={20} />}
              {league.id === "uefa.champions" ? "More clubs in the Champions League" : league.label}
            </h3>
            <div className={styles.teamGrid}>
              {league.teams.map((team) => (
                <button key={team.id} type="button" className={`${styles.teamOption} ${current === team.id ? styles.teamOptionOn : ""}`} onClick={() => void choose(team)} disabled={!!saving}>
                  <Crest src={team.logo} name={team.name} size={38} />
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
