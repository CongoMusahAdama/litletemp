const express = require('express');
const Bet = require('../models/Bet');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getMatches, getTeams } = require('../lib/football');
const { settleDueBets } = require('../lib/bets');
const { deliver, iconFor } = require('../lib/push');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function partnerIdOf(couple, userId) {
  return [couple.partner1, couple.partner2]
    .map((id) => (id ? String(id) : ''))
    .find((id) => id && id !== String(userId)) || '';
}

// Your partner's scoreline stays hidden until kickoff, so nobody can copy.
function presentBet(bet, viewerId) {
  const me = String(viewerId);
  const started = new Date(bet.match.kickoff).getTime() <= Date.now();
  const mine = bet.picks.find((pick) => String(pick.userId) === me);
  const theirs = bet.picks.find((pick) => String(pick.userId) !== me);
  const winnerId = bet.result?.winnerId ? String(bet.result.winnerId) : '';
  return {
    id: bet._id,
    matchId: bet.matchId,
    league: bet.league,
    match: bet.match,
    status: bet.status,
    result: bet.result && bet.status !== 'open'
      ? { homeScore: bet.result.homeScore, awayScore: bet.result.awayScore, reason: bet.result.reason || '' }
      : null,
    mine: mine ? { homeGoals: mine.homeGoals, awayGoals: mine.awayGoals, prize: mine.prize || '' } : null,
    theirs: theirs ? {
      prize: theirs.prize || '',
      homeGoals: started ? theirs.homeGoals : null,
      awayGoals: started ? theirs.awayGoals : null,
    } : null,
    outcome: !winnerId ? (bet.status === 'settled' ? 'tie' : null) : winnerId === me ? 'won' : 'lost',
    paid: bet.paid,
    locked: started,
  };
}

function pushChanged(req) {
  const io = getIo();
  if (io) io.to(`couple:${req.couple._id}`).emit('bet:changed', {});
}

router.get('/teams', async (req, res, next) => {
  try {
    res.json(await getTeams());
  } catch (error) {
    next(error);
  }
});

router.get('/matches', async (req, res, next) => {
  try {
    res.json(await getMatches());
  } catch (error) {
    next(error);
  }
});

// Choose the club you support.
router.put('/team', async (req, res, next) => {
  try {
    const teams = await getTeams();
    const team = teams.find((item) => item.id === String(req.body.teamId || ''));
    if (!team) return res.status(400).json({ error: 'Pick a team from the list' });
    req.user.favoriteTeam = { id: team.id, name: team.name, logo: team.logo, league: team.league };
    await req.user.save();
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('partner:updated');
    res.json(req.user.toPublic());
  } catch (error) {
    next(error);
  }
});

router.get('/bets', async (req, res, next) => {
  try {
    await settleDueBets(getIo()).catch(() => undefined);
    const bets = await Bet.find({ coupleId: req.couple._id }).sort({ 'match.kickoff': -1 }).limit(100);
    res.json(bets.map((bet) => presentBet(bet, req.user._id)));
  } catch (error) {
    next(error);
  }
});

// Place or change your prediction (and your prize) before kickoff.
router.post('/bets', async (req, res, next) => {
  try {
    const homeGoals = Math.round(Number(req.body.homeGoals));
    const awayGoals = Math.round(Number(req.body.awayGoals));
    const prize = String(req.body.prize || '').trim().slice(0, 200);
    if (![homeGoals, awayGoals].every((goals) => Number.isFinite(goals) && goals >= 0 && goals <= 20)) {
      return res.status(400).json({ error: 'Enter a scoreline' });
    }
    if (!prize) return res.status(400).json({ error: 'Say what they owe you if you win' });
    const match = (await getMatches()).find((item) => item.id === String(req.body.matchId || ''));
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'scheduled' || new Date(match.kickoff).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Betting closed at kickoff' });
    }

    let bet = await Bet.findOne({ coupleId: req.couple._id, matchId: match.id });
    if (!bet) {
      bet = new Bet({
        coupleId: req.couple._id,
        matchId: match.id,
        league: match.league,
        createdBy: req.user._id,
        match: {
          leagueName: match.leagueName,
          leagueLogo: match.leagueLogo,
          kickoff: new Date(match.kickoff),
          home: { id: match.home.id, name: match.home.name, logo: match.home.logo },
          away: { id: match.away.id, name: match.away.name, logo: match.away.logo },
        },
      });
    }
    const me = String(req.user._id);
    const hadPick = bet.picks.some((pick) => String(pick.userId) === me);
    bet.picks = bet.picks.filter((pick) => String(pick.userId) !== me);
    bet.picks.push({ userId: req.user._id, homeGoals, awayGoals, prize });
    bet.match.kickoff = new Date(match.kickoff);
    await bet.save();
    pushChanged(req);

    if (!hadPick) {
      const partnerId = partnerIdOf(req.couple, req.user._id);
      const partner = partnerId ? await User.findById(partnerId) : null;
      const theyBet = bet.picks.length > 1;
      deliver(partner, {
        kind: 'bet',
        title: `⚽ ${match.home.short} vs ${match.away.short}`,
        body: theyBet
          ? `${req.user.name} took you on. Bet's locked in until kickoff.`
          : `${req.user.name} placed a bet. If they win you owe: ${prize}. Place yours!`,
        icon: iconFor(req.user),
      }).catch(() => undefined);
    }
    res.status(201).json(presentBet(bet, req.user._id));
  } catch (error) {
    next(error);
  }
});

// Take your prediction back before kickoff.
router.delete('/bets/:id/mine', async (req, res, next) => {
  try {
    const bet = await Bet.findOne({ _id: req.params.id, coupleId: req.couple._id, status: 'open' });
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    if (new Date(bet.match.kickoff).getTime() <= Date.now()) return res.status(400).json({ error: 'Betting closed at kickoff' });
    bet.picks = bet.picks.filter((pick) => String(pick.userId) !== String(req.user._id));
    if (bet.picks.length) await bet.save();
    else await bet.deleteOne();
    pushChanged(req);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// The winner marks the prize as received.
router.post('/bets/:id/paid', async (req, res, next) => {
  try {
    const bet = await Bet.findOne({ _id: req.params.id, coupleId: req.couple._id, status: 'settled' });
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    bet.paid = req.body.paid !== false;
    await bet.save();
    pushChanged(req);
    res.json(presentBet(bet, req.user._id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
