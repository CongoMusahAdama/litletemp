const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { presentMessage, dayKey } = require('../lib/present');
const { saveMessage } = require('../lib/messages');
const { touchStreak } = require('../lib/couple');
const { getIo, isOnline } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

router.get('/summary', async (req, res, next) => {
  try {
    const partnerId = String(req.couple.partner1) === String(req.user._id)
      ? req.couple.partner2
      : req.couple.partner1;
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
      streak: req.couple.currentStreak,
      partnerOnline: partner ? isOnline(partner._id) : false,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/streak', async (req, res, next) => {
  try {
    const streak = await touchStreak(req.couple, req.user._id);
    const today = dayKey();
    const youAreFirst = String(req.couple.partner1) === String(req.user._id);
    const partnerCheckedIn = (youAreFirst ? req.couple.partner2ActiveDate : req.couple.partner1ActiveDate) === today;
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('streak:updated', { streak });
    res.json({ streak, partnerCheckedIn });
  } catch (error) {
    next(error);
  }
});

router.get('/messages', async (req, res, next) => {
  try {
    const messages = await Message.find({ coupleId: req.couple._id }).sort({ createdAt: 1 }).limit(200);
    res.json(messages.map(presentMessage));
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

module.exports = router;
