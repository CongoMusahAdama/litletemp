const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { presentMessage } = require('../lib/present');
const { saveMessage } = require('../lib/messages');
const { touchStreak, streakView } = require('../lib/couple');
const { getIo, isOnline } = require('../socket');
const { deliver, iconFor } = require('../lib/push');

const router = express.Router();
router.use(requireAuth, requireCouple);

const PIN_HOURS = new Set([24, 168, 720]);

function pinPreview(message) {
  if (!message || message.isDeleted) return '';
  if (message.type === 'image') return 'Photo';
  if (message.type === 'video') return 'Video';
  if (message.type === 'voice') return 'Voice note';
  return String(message.text || 'Message').slice(0, 140);
}

async function clearPin(couple) {
  await couple.updateOne({ $unset: { pinnedMessageId: 1, pinnedUntil: 1, pinnedBy: 1 } });
  couple.pinnedMessageId = undefined;
  couple.pinnedUntil = undefined;
  couple.pinnedBy = undefined;
}

async function currentPin(couple) {
  if (!couple.pinnedMessageId || !couple.pinnedUntil) return null;
  if (new Date(couple.pinnedUntil).getTime() <= Date.now()) {
    await clearPin(couple);
    return null;
  }
  const message = await Message.findOne({ _id: couple.pinnedMessageId, coupleId: couple._id });
  if (!message || message.isDeleted || message.type === 'system') {
    await clearPin(couple);
    return null;
  }
  return {
    message: presentMessage(message),
    until: couple.pinnedUntil,
    preview: pinPreview(message),
  };
}

function emitPin(couple, pin) {
  const io = getIo();
  if (io) io.to(`couple:${couple._id}`).emit('pin:updated', pin);
}

router.get('/summary', async (req, res, next) => {
  try {
    const selfId = String(req.user._id);
    const partnerId = [req.couple.partner1, req.couple.partner2]
      .map((id) => (id ? String(id) : ''))
      .find((id) => id && id !== selfId) || '';
    const [partner, last, unread] = await Promise.all([
      partnerId ? User.findById(partnerId) : null,
      Message.findOne({ coupleId: req.couple._id }).sort({ createdAt: -1 }),
      Message.countDocuments({
        coupleId: req.couple._id,
        senderId: { $ne: req.user._id },
        readByPartner: false,
        isDeleted: false,
      }),
    ]);
    res.json({
      partner: partner ? partner.toPublic() : null,
      expectedPartnerName: req.couple.expectedPartnerName,
      lastMessage: last ? presentMessage(last) : null,
      unread,
      streak: streakView(req.couple, req.user._id).streak,
      partnerOnline: partner ? await isOnline(partner._id, req.couple._id) : false,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/streak', (req, res) => {
  res.json(streakView(req.couple, req.user._id));
});

router.post('/streak', async (req, res, next) => {
  try {
    const streak = await touchStreak(req.couple, req.user._id);
    const view = streakView(req.couple, req.user._id);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('streak:updated', { streak });
    res.json({ ...view, streak, partnerCheckedIn: view.partnerCheckedIn });
  } catch (error) {
    next(error);
  }
});

router.get('/messages', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 80));
    const query = { coupleId: req.couple._id };
    if (req.query.before) {
      const before = new Date(String(req.query.before));
      if (Number.isNaN(before.getTime())) return res.status(400).json({ error: 'Invalid cursor' });
      query.createdAt = { $lt: before };
    }
    const rows = await Message.find(query).sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    res.json({ messages: page.map(presentMessage), hasMore });
  } catch (error) {
    next(error);
  }
});

router.post('/messages', async (req, res, next) => {
  try {
    const message = await saveMessage(req.user, req.couple, req.body);
    res.status(201).json(presentMessage(message));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.patch('/messages/:id', async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message || message.isDeleted) return res.status(404).json({ error: 'Message not found' });
    if (String(message.senderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty' });
    message.text = text.slice(0, 4000);
    message.isEdited = true;
    await message.save();
    const payload = presentMessage(message);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('message:updated', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

// React to a message. The same emoji again removes it; a new one replaces yours.
router.post('/messages/:id/react', async (req, res, next) => {
  try {
    const emoji = String(req.body.emoji || '').trim();
    if (!emoji || emoji.length > 16) return res.status(400).json({ error: 'Pick a reaction' });
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message || message.isDeleted || message.type === 'system') return res.status(404).json({ error: 'Message not found' });
    const me = String(req.user._id);
    const previous = (message.reactions || []).find((item) => String(item.userId) === me);
    message.reactions = (message.reactions || []).filter((item) => String(item.userId) !== me);
    const added = !previous || previous.emoji !== emoji;
    if (added) message.reactions.push({ userId: req.user._id, emoji });
    await message.save();
    const payload = presentMessage(message);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('message:updated', payload);

    if (added && String(message.senderId) !== me) {
      const author = await User.findById(message.senderId);
      const preview = message.type === 'text' ? `"${String(message.text || '').slice(0, 60)}"`
        : message.type === 'image' ? 'your photo' : message.type === 'video' ? 'your video' : 'your voice note';
      deliver(author, {
        kind: 'reaction',
        title: req.user.name || 'Little Temptation',
        body: `Reacted ${emoji} to ${preview}`,
        icon: iconFor(req.user),
      }).catch(() => undefined);
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete('/messages/:id', async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (String(message.senderId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    message.isDeleted = true;
    message.text = undefined;
    message.mediaUrl = undefined;
    await message.save();
    const payload = presentMessage(message);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('message:updated', payload);
    if (String(req.couple.pinnedMessageId || '') === String(message._id)) {
      await clearPin(req.couple);
      emitPin(req.couple, null);
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/read', async (req, res, next) => {
  try {
    await Message.updateMany(
      { coupleId: req.couple._id, senderId: { $ne: req.user._id }, readByPartner: false },
      { readByPartner: true }
    );
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('messages:read', { readerId: req.user._id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/pin', async (req, res, next) => {
  try {
    res.json((await currentPin(req.couple)) || { message: null });
  } catch (error) {
    next(error);
  }
});

router.post('/messages/:id/pin', async (req, res, next) => {
  try {
    const hours = Number(req.body.hours);
    if (!PIN_HOURS.has(hours)) return res.status(400).json({ error: 'Choose 24 hours, 7 days, or 30 days' });
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message || message.isDeleted || message.type === 'system') {
      return res.status(404).json({ error: 'That message cannot be pinned' });
    }
    req.couple.pinnedMessageId = message._id;
    req.couple.pinnedBy = req.user._id;
    req.couple.pinnedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    await req.couple.save();
    const pin = await currentPin(req.couple);
    emitPin(req.couple, pin);
    res.json(pin);
  } catch (error) {
    next(error);
  }
});

router.delete('/pin', async (req, res, next) => {
  try {
    await clearPin(req.couple);
    emitPin(req.couple, null);
    res.json({ message: null });
  } catch (error) {
    next(error);
  }
});

router.post('/messages/:id/view', async (req, res, next) => {
  try {
    const message = await Message.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (!message.viewOnce) return res.status(400).json({ error: 'Not a view-once message' });
    // Only the recipient can mark it as viewed
    if (String(message.senderId) === String(req.user._id)) {
      return res.status(403).json({ error: 'Cannot open your own view-once message' });
    }
    if (message.viewedByPartner) return res.json(presentMessage(message));
    message.viewedByPartner = true;
    await message.save();
    const payload = presentMessage(message);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('message:updated', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
