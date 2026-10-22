const express = require('express');
const DayRecap = require('../models/DayRecap');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { touchStreak } = require('../lib/couple');
const { deliver, iconFor } = require('../lib/push');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

const DAY_MS = 24 * 60 * 60 * 1000;

// The phone sends its own local date; accept it if it's within a day of the server's.
function cleanDay(value) {
  const day = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const at = new Date(`${day}T12:00:00Z`).getTime();
  if (!Number.isFinite(at) || Math.abs(at - Date.now()) > 1.6 * DAY_MS) return '';
  return day;
}

function partnerIdOf(couple, userId) {
  return [couple.partner1, couple.partner2]
    .map((id) => (id ? String(id) : ''))
    .find((id) => id && id !== String(userId)) || '';
}

function presentOne(recap) {
  return recap ? { rating: recap.rating, text: recap.text, at: recap.updatedAt } : null;
}

// Your partner's check-in stays hidden until you've shared yours.
function presentDay(day, recaps, viewerId) {
  const me = String(viewerId);
  const mine = recaps.find((item) => String(item.userId) === me);
  const theirs = recaps.find((item) => String(item.userId) !== me);
  return {
    day,
    mine: presentOne(mine),
    theirs: mine ? presentOne(theirs) : null,
    theyShared: Boolean(theirs),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const day = cleanDay(req.query.day);
    if (!day) return res.status(400).json({ error: 'Send your date' });
    const recaps = await DayRecap.find({ coupleId: req.couple._id, day });
    res.json(presentDay(day, recaps, req.user._id));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const day = cleanDay(req.body.day);
    const rating = Math.round(Number(req.body.rating));
    const text = String(req.body.text || '').trim().slice(0, 1000);
    if (!day) return res.status(400).json({ error: 'Send your date' });
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Pick how your day felt' });
    if (!text) return res.status(400).json({ error: 'Write a few words about your day' });

    const existing = await DayRecap.findOne({ coupleId: req.couple._id, day, userId: req.user._id });
    await DayRecap.findOneAndUpdate(
      { coupleId: req.couple._id, day, userId: req.user._id },
      { $set: { rating, text } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const streak = await touchStreak(req.couple, req.user._id);
    const recaps = await DayRecap.find({ coupleId: req.couple._id, day });

    const io = getIo();
    [req.couple.partner1, req.couple.partner2].filter(Boolean).forEach((id) => {
      io.to(`user:${id}`).emit('recap:updated', presentDay(day, recaps, id));
    });
    io.to(`couple:${req.couple._id}`).emit('streak:updated', { streak });

    // Tell your partner the first time you share today (not on every edit).
    const partnerId = partnerIdOf(req.couple, req.user._id);
    if (partnerId && !existing) {
      const partner = await User.findById(partnerId);
      const theyShared = recaps.length > 1;
      deliver(partner, {
        kind: 'recap',
        title: '🌙 Evening check-in',
        body: theyShared
          ? `${req.user.name} shared how their day went. Open to read it 💞`
          : `${req.user.name} shared how their day went. Share yours to read it.`,
        icon: iconFor(req.user),
      });
    }

    res.status(201).json(presentDay(day, recaps, req.user._id));
  } catch (error) {
    next(error);
  }
});

// Days you both shared, newest first.
router.get('/history', async (req, res, next) => {
  try {
    const rows = await DayRecap.find({ coupleId: req.couple._id }).sort({ day: -1 }).limit(120);
    const byDay = new Map();
    rows.forEach((row) => {
      if (!byDay.has(row.day)) byDay.set(row.day, []);
      byDay.get(row.day).push(row);
    });
    const history = [...byDay.entries()]
      .filter(([, recaps]) => recaps.length > 1)
      .slice(0, 30)
      .map(([day, recaps]) => presentDay(day, recaps, req.user._id));
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
