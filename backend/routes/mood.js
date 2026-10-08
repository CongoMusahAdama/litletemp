const express = require('express');
const Mood = require('../models/Mood');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { dayKey } = require('../lib/present');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

const ALLOWED = ['Happy', 'In Love', 'Excited', 'Calm', 'Missing You', 'Tired', 'Sad', 'Angry', 'Neutral'];

function weekDates() {
  const now = new Date();
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return dayKey(date);
  });
}

function monthDates() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dates = [];
  for (let cursor = new Date(start); cursor.getUTCMonth() === start.getUTCMonth(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(dayKey(cursor));
  }
  return dates;
}

router.get('/', async (req, res, next) => {
  try {
    const range = req.query.range === 'month' ? monthDates() : weekDates();
    const rows = await Mood.find({
      coupleId: req.couple._id,
      date: { $in: range },
    });
    const mine = {};
    const partner = {};
    rows.forEach((row) => {
      const bucket = String(row.userId) === String(req.user._id) ? mine : partner;
      bucket[row.date] = row.mood;
    });
    res.json({ dates: range, mine, partner, today: dayKey() });
  } catch (error) {
    next(error);
  }
});

router.get('/insights', async (req, res, next) => {
  try {
    const rows = await Mood.find({ coupleId: req.couple._id });
    const tally = (list) => {
      const counts = {};
      list.forEach((row) => { counts[row.mood] = (counts[row.mood] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    };
    const mine = rows.filter((row) => String(row.userId) === String(req.user._id));
    const theirs = rows.filter((row) => String(row.userId) !== String(req.user._id));
    const days = new Set(mine.map((row) => row.date));
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 60; i += 1) {
      const key = dayKey(cursor);
      if (!days.has(key)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    res.json({
      mostFrequent: tally(mine),
      partnerTop: tally(theirs),
      streak,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const mood = String(req.body.mood || '');
    if (!ALLOWED.includes(mood)) return res.status(400).json({ error: 'Choose a mood from the list' });
    const date = req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : dayKey();
    const saved = await Mood.findOneAndUpdate(
      { coupleId: req.couple._id, userId: req.user._id, date },
      { mood },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    const payload = { date, mood: saved.mood, userId: req.user._id };
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('mood:updated', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
