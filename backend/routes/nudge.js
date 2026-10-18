const express = require('express');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { deliver } = require('../lib/push');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

const EMOJIS = ['💗', '😘', '🥰', '🫶', '🔥'];
const COOLDOWN_MS = 2500;
const lastSent = new Map();

router.post('/', async (req, res, next) => {
  try {
    const me = String(req.user._id);
    const now = Date.now();
    if (now - (lastSent.get(me) || 0) < COOLDOWN_MS) {
      return res.status(429).json({ error: 'Easy, they felt that one 💗' });
    }
    lastSent.set(me, now);

    const emoji = EMOJIS.includes(req.body.emoji) ? req.body.emoji : '💗';
    const partnerId = [req.couple.partner1, req.couple.partner2]
      .map((id) => (id ? String(id) : ''))
      .find((id) => id && id !== me);
    if (!partnerId) return res.status(409).json({ error: 'Your partner has not joined yet' });

    const name = req.user.name || req.user.username || 'Your person';
    const io = getIo();
    if (io) io.to(`user:${partnerId}`).emit('nudge', { emoji, name, at: now });

    const partner = await User.findById(partnerId);
    deliver(partner, {
      kind: 'nudge',
      title: `${emoji} ${name} is thinking of you`,
      body: 'Tap to send one back',
    }).catch(() => undefined);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
