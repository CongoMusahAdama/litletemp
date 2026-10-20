// Fixtures, live scores and teams for the leagues below, from ESPN's public
// scoreboard (no API key). Everything is cached so phones never call ESPN directly.
const LEAGUES = {
  'eng.1': 'Premier League',
  'esp.1': 'LaLiga',
};

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

async function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = await load();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (error) {
    if (hit) return hit.data; // ESPN hiccup: keep showing the last good copy.
    throw error;
  }
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Football data unavailable (${response.status})`);
  return response.json();
}

function side(competitor, state) {
  const team = competitor?.team || {};
  return {
    id: String(team.id || ''),
    name: team.displayName || team.name || '',
    short: team.shortDisplayName || team.abbreviation || team.displayName || '',
    logo: team.logo || team.logos?.[0]?.href || '',
    score: state === 'pre' ? null : Number(competitor?.score ?? 0),
  };
}

function normalize(event, league) {
  const competition = event.competitions?.[0] || {};
  const type = event.status?.type || {};
  const state = type.state || 'pre';
  const name = String(type.name || '');
  let status = state === 'in' ? 'live' : state === 'post' ? 'finished' : 'scheduled';
  if (/POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED/.test(name)) status = 'off';
  const home = competition.competitors?.find((item) => item.homeAway === 'home');
  const away = competition.competitors?.find((item) => item.homeAway === 'away');
  return {
    id: String(event.id),
    league,
    leagueName: LEAGUES[league],
    kickoff: event.date,
    status,
    detail: type.shortDetail || type.detail || '',
    clock: event.status?.displayClock || '',
    home: side(home, state),
    away: side(away, state),
  };
}

function monthKey(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// A whole month of one league in a single request (ESPN rejects day ranges).
async function monthEvents(league, yyyymm, ttlMs) {
  return cached(`month:${league}:${yyyymm}`, ttlMs, async () => {
    const data = await getJson(`${BASE}/${league}/scoreboard?dates=${yyyymm}`);
    return (data.events || []).map((event) => normalize(event, league));
  });
}

/** Matches from 3 days ago to 3 weeks ahead, both leagues, soonest first. */
async function getMatches() {
  const now = new Date();
  const months = new Set([monthKey(new Date(now.getTime() - 3 * DAY_MS)), monthKey(now), monthKey(new Date(now.getTime() + 21 * DAY_MS))]);
  const lists = await Promise.all(Object.keys(LEAGUES).flatMap((league) => [...months].map((month) => {
    // The current month refreshes often (live scores); others rarely change.
    const ttl = month === monthKey(now) ? 60 * 1000 : 15 * 60 * 1000;
    return monthEvents(league, month, ttl).catch(() => []);
  })));
  const from = now.getTime() - 3 * DAY_MS;
  const to = now.getTime() + 21 * DAY_MS;
  const seen = new Set();
  return lists.flat()
    .filter((match) => {
      const at = new Date(match.kickoff).getTime();
      if (seen.has(match.id) || at < from || at > to) return false;
      seen.add(match.id);
      return true;
    })
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}

/** One match, even if it's older than the main list (used when settling bets). */
async function findMatch(league, matchId, kickoff) {
  const list = await monthEvents(league, monthKey(new Date(kickoff)), 60 * 1000);
  return list.find((match) => match.id === String(matchId)) || null;
}

async function getTeams() {
  return cached('teams', DAY_MS, async () => {
    const lists = await Promise.all(Object.entries(LEAGUES).map(async ([league, leagueName]) => {
      const data = await getJson(`${BASE}/${league}/teams`);
      const teams = data.sports?.[0]?.leagues?.[0]?.teams || [];
      return teams.map(({ team }) => ({
        id: String(team.id),
        name: team.displayName,
        short: team.shortDisplayName || team.abbreviation,
        logo: team.logos?.[0]?.href || '',
        league,
        leagueName,
      }));
    }));
    return lists.flat().sort((a, b) => a.name.localeCompare(b.name));
  });
}

module.exports = { LEAGUES, getMatches, findMatch, getTeams };
