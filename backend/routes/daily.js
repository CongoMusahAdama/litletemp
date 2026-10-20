const express = require('express');
const DailyAnswer = require('../models/DailyAnswer');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { dayKey } = require('../lib/present');
const { touchStreak } = require('../lib/couple');
const { questionFor } = require('../lib/questions');
const { deliver, iconFor } = require('../lib/push');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function partnerIdOf(couple, userId) {
  return [couple.partner1, couple.partner2]
    .map((id) => (id ? String(id) : ''))
    .find((id) => id && id !== String(userId)) || '';
}

// Your partner's answer stays hidden until you have answered too.
function presentDay(day, question, answers, viewerId) {
  const me = String(viewerId);
  const mine = answers.find((item) => String(item.userId) === me);
  const theirs = answers.find((item) => String(item.userId) !== me);
  return {
    day,
    question,
    mine: mine ? mine.text : null,
    theirs: mine && theirs ? theirs.text : null,
    theyAnswered: Boolean(theirs),
  };
}

async function today(req) {
  const day = dayKey();
  const answers = await DailyAnswer.find({ coupleId: req.couple._id, day });
  const question = answers[0]?.question || questionFor(req.couple._id, day).text;
  return { day, question, answers };
}

router.get('/', async (req, res, next) => {
  try {
    const { day, question, answers } = await today(req);
    res.json(presentDay(day, question, answers, req.user._id));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 600);
    if (!text) return res.status(400).json({ error: 'Write your answer first' });
    const { day, question } = await today(req);
    await DailyAnswer.findOneAndUpdate(
      { coupleId: req.couple._id, day, userId: req.user._id },
      { $set: { text, question } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const streak = await touchStreak(req.couple, req.user._id);
    const answers = await DailyAnswer.find({ coupleId: req.couple._id, day });

    const io = getIo();
    if (io) {
      const sockets = await io.in(`couple:${req.couple._id}`).fetchSockets();
      sockets.forEach((peer) => peer.emit('daily:updated', presentDay(day, question, answers, peer.user._id)));
      io.to(`couple:${req.couple._id}`).emit('streak:updated', { streak });
    }

    const partnerId = partnerIdOf(req.couple, req.user._id);
    if (partnerId) {
      const partner = await User.findById(partnerId);
      const bothDone = answers.length > 1;
      deliver(partner, {
        kind: 'daily',
        title: 'Question of the day 💬',
        body: bothDone
          ? `${req.user.name} answered too. Open to see their answer.`
          : `${req.user.name} answered today's question. Answer to see what they said.`,
        icon: iconFor(req.user),
      }).catch(() => undefined);
    }

    res.status(201).json(presentDay(day, question, answers, req.user._id));
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const rows = await DailyAnswer.find({ coupleId: req.couple._id, day: { $lt: dayKey() } })
      .sort({ day: -1 })
      .limit(120);
    const byDay = new Map();
    rows.forEach((row) => {
      if (!byDay.has(row.day)) byDay.set(row.day, []);
      byDay.get(row.day).push(row);
    });
    const history = [...byDay.entries()]
      .filter(([, answers]) => answers.length > 1)
      .slice(0, 30)
      .map(([day, answers]) => presentDay(day, answers[0].question, answers, req.user._id));
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
