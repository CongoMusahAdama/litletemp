const Bet = require('../models/Bet');
const User = require('../models/User');
const { findMatch } = require('./football');
const { deliver, iconFor } = require('./push');
const { log } = require('./log');

function outcome(home, away) {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

/**
 * Who wins a bet, given both predictions and the final score:
 * 1. an exact score beats everything,
 * 2. otherwise the right result (win / draw / loss) wins,
 * 3. otherwise the prediction closest to the real score wins,
 * 4. still level: a tie, nobody owes.
 */
function judge(picks, homeScore, awayScore) {
  if (picks.length < 2) return { winnerId: null, reason: 'Only one of you placed a bet' };
  const real = outcome(homeScore, awayScore);
  const scored = picks.map((pick) => ({
    userId: pick.userId,
    exact: pick.homeGoals === homeScore && pick.awayGoals === awayScore,
    result: outcome(pick.homeGoals, pick.awayGoals) === real,
    miss: Math.abs(pick.homeGoals - homeScore) + Math.abs(pick.awayGoals - awayScore),
  }));
  const [a, b] = scored;
  if (a.exact !== b.exact) return { winnerId: (a.exact ? a : b).userId, reason: 'Exact score!' };
  if (a.exact && b.exact) return { winnerId: null, reason: 'You both called the exact score' };
  if (a.result !== b.result) return { winnerId: (a.result ? a : b).userId, reason: 'Called the result' };
  if (a.miss !== b.miss) return { winnerId: (a.miss < b.miss ? a : b).userId, reason: 'Closest to the score' };
  return { winnerId: null, reason: "It's a tie" };
}

async function notifySettled(bet) {
  const winnerId = bet.result?.winnerId ? String(bet.result.winnerId) : '';
  const users = await User.find({ _id: { $in: bet.picks.map((pick) => pick.userId) } });
  const title = `⚽ ${bet.match.home.name} ${bet.result.homeScore}–${bet.result.awayScore} ${bet.match.away.name}`;
  for (const user of users) {
    const other = users.find((person) => String(person._id) !== String(user._id));
    const winnerPick = bet.picks.find((pick) => String(pick.userId) === winnerId);
    let body;
    if (!winnerId) body = `${bet.result.reason}. Nobody owes anything this time.`;
    else if (String(user._id) === winnerId) body = `🏆 You won! ${other?.name || 'They'} owes you: ${winnerPick?.prize || 'a surprise'}`;
    else body = `😅 You lost. You owe ${other?.name || 'them'}: ${winnerPick?.prize || 'a surprise'}`;
    await deliver(user, { kind: 'bet', title, body, icon: other ? iconFor(other) : undefined }).catch(() => undefined);
  }
}

/** Settle every open bet whose match has finished (or void it if the match was called off). */
async function settleDueBets(io) {
  const due = await Bet.find({ status: 'open', 'match.kickoff': { $lt: new Date() } }).limit(200);
  for (const bet of due) {
    try {
      const match = await findMatch(bet.league, bet.matchId, bet.match.kickoff);
      if (!match) continue;
      if (match.status === 'off') {
        bet.status = 'void';
        bet.result = { reason: 'The match was called off' };
      } else if (match.status === 'finished') {
        const homeScore = match.home.score ?? 0;
        const awayScore = match.away.score ?? 0;
        const verdict = judge(bet.picks, homeScore, awayScore);
        bet.status = bet.picks.length < 2 ? 'void' : 'settled';
        bet.result = { homeScore, awayScore, ...verdict };
      } else {
        continue;
      }
      bet.settledAt = new Date();
      await bet.save();
      if (io) io.to(`couple:${bet.coupleId}`).emit('bet:changed', { id: String(bet._id) });
      if (bet.status === 'settled') await notifySettled(bet);
    } catch (error) {
      log('error', 'bet settle failed', { bet: String(bet._id), stack: error.stack });
    }
  }
}

module.exports = { judge, settleDueBets };
