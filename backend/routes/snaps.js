const express = require('express');
const Snap = require('../models/Snap');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { publicMedia, bareUpload } = require('../lib/present');
const { saveMessage } = require('../lib/messages');

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(snap) {
  return {
    id: snap._id,
    mediaUrl: publicMedia(snap.mediaUrl),
    sentCount: snap.sentCount || 0,
    createdAt: snap.createdAt,
  };
}

function mine(req) {
  return { coupleId: req.couple._id, authorId: req.user._id };
}

router.get('/', async (req, res, next) => {
  try {
    const snaps = await Snap.find(mine(req)).sort({ createdAt: -1 }).limit(500);
    res.json(snaps.map(present));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const mediaUrl = bareUpload(req.body.mediaUrl);
    if (!mediaUrl) return res.status(400).json({ error: 'Take a snap first' });
    const snap = await Snap.create({ ...mine(req), mediaUrl });
    res.status(201).json(present(snap));
  } catch (error) {
    next(error);
  }
});

// Send a snap from Memories into the chat. It counts toward the streak like any message.
router.post('/:id/send', async (req, res, next) => {
  try {
    const snap = await Snap.findOne({ _id: req.params.id, ...mine(req) });
    if (!snap) return res.status(404).json({ error: 'Snap not found' });
    await saveMessage(req.user, req.couple, {
      type: 'image',
      mediaUrl: snap.mediaUrl,
      viewOnce: Boolean(req.body.viewOnce),
    });
    snap.sentCount = (snap.sentCount || 0) + 1;
    await snap.save();
    res.json(present(snap));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const snap = await Snap.findOneAndDelete({ _id: req.params.id, ...mine(req) });
    if (!snap) return res.status(404).json({ error: 'Snap not found' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
