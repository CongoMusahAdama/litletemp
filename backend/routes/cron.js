const express = require('express');
const { sendMorningNotes, sendAwayNotes, sendEveningNotes } = require('../lib/morning');
const { settleDueBets } = require('../lib/bets');
const { getIo } = require('../socket');

const router = express.Router();

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". An outside pinger can
// pass ?key=<CRON_SECRET> instead.
function allowed(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}` || req.query.key === secret;
}

// Daily jobs: good-morning notes, "missing you" notes, and settling match bets.
router.get('/daily', async (req, res, next) => {
  if (!allowed(req)) return res.status(401).json({ error: 'Not allowed' });
  try {
    await Promise.allSettled([sendMorningNotes(), sendAwayNotes(), settleDueBets(getIo())]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Evening check-in reminders (Vercel Cron, 19:00 UTC).
router.get('/evening', async (req, res, next) => {
  if (!allowed(req)) return res.status(401).json({ error: 'Not allowed' });
  try {
    await sendEveningNotes();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Bets only (cheap enough to run often from an outside pinger).
router.get('/settle', async (req, res, next) => {
  if (!allowed(req)) return res.status(401).json({ error: 'Not allowed' });
  try {
    await settleDueBets(getIo());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
