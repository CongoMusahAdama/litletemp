const express = require('express');
const bcrypt = require('bcryptjs');
const Message = require('../models/Message');
const JournalEntry = require('../models/JournalEntry');
const BucketItem = require('../models/BucketItem');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { presentCouple, daysUntil, presentMessage } = require('../lib/present');
const { getIo } = require('../socket');

const router = express.Router();

router.use(requireAuth);

router.patch('/', async (req, res, next) => {
  try {
    const { name, username, avatarUrl, notifications, language, theme, pin, bubbleColor } = req.body;
    if (name !== undefined) {
      const clean = String(name).trim().slice(0, 40);
      if (!clean) return res.status(400).json({ error: 'Name cannot be empty' });
      req.user.name = clean;
    }
    if (username !== undefined) {
      const clean = String(username).trim().replace(/^@/, '').toLowerCase().slice(0, 20);
      if (clean && !/^[a-z0-9_]{3,20}$/.test(clean)) {
        return res.status(400).json({ error: 'Usernames need 3 to 20 letters or numbers' });
      }
      if (clean) {
        const taken = await User.findOne({ username: clean, _id: { $ne: req.user._id } });
        if (taken) return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
      }
      req.user.username = clean || undefined;
    }
    if (avatarUrl !== undefined) req.user.avatarUrl = String(avatarUrl).slice(0, 500);
    if (typeof notifications === 'boolean') req.user.notifications = notifications;
    if (language) req.user.language = String(language).slice(0, 40);
    if (theme === 'light' || theme === 'dark') req.user.theme = theme;
    if (typeof bubbleColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(bubbleColor)) {
      req.user.bubbleColor = bubbleColor.toUpperCase();
    }
    if (pin !== undefined) {
      const digits = String(pin);
      if (!/^\d{4,6}$/.test(digits)) {
        return res.status(400).json({ error: 'PIN must be 4 to 6 digits' });
      }
      req.user.pinHash = await bcrypt.hash(digits, 10);
    }
    await req.user.save();
    const io = getIo();
    if (io && req.user.coupleId) {
      io.to(`couple:${req.user.coupleId}`).emit('partner:updated', { user: req.user.toPublic() });
    }
    res.json({ user: req.user.toPublic() });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That username is taken' });
    next(error);
  }
});

router.post('/pin/verify', async (req, res, next) => {
  try {
    if (!req.user.pinHash) return res.status(400).json({ error: 'No PIN is set' });
    const ok = await bcrypt.compare(String(req.body.pin || ''), req.user.pinHash);
    if (!ok) return res.status(400).json({ error: 'Incorrect PIN' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', requireCouple, async (req, res, next) => {
  try {
    const [memories, bucket] = await Promise.all([
      JournalEntry.countDocuments({ coupleId: req.couple._id }),
      BucketItem.countDocuments({ coupleId: req.couple._id }),
    ]);
    res.json({
      memories,
      bucket,
      daysToGo: daysUntil(req.couple.anniversary),
      streak: req.couple.currentStreak,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/couple', requireCouple, async (req, res, next) => {
  try {
    const partnerId = String(req.couple.partner1) === String(req.user._id)
      ? req.couple.partner2
      : req.couple.partner1;
    const partner = partnerId ? await User.findById(partnerId) : null;
    res.json({
      couple: presentCouple(req.couple, req.user),
      partner: partner ? partner.toPublic() : null,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/couple', requireCouple, async (req, res, next) => {
  try {
    if (req.body.anniversary) {
      const date = new Date(req.body.anniversary);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid anniversary date' });
      req.couple.anniversary = date;
    }
    if (req.body.wallpaperUrl !== undefined) {
      req.couple.wallpaperUrl = String(req.body.wallpaperUrl).slice(0, 500);
    }
    await req.couple.save();
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('couple:updated', presentCouple(req.couple, req.user));
    res.json({ couple: presentCouple(req.couple, req.user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireCouple, async (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'Tell your partner why you are leaving' });

    const message = await Message.create({
      coupleId: req.couple._id,
      senderId: req.user._id,
      text: `👋 I logged out. Reason: ${reason}`,
      type: 'text',
    });
    const io = getIo();
    if (io) {
      io.to(`couple:${req.couple._id}`).emit('message:new', presentMessage(message));
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
