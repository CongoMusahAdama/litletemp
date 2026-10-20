const express = require('express');
const Sticker = require('../models/Sticker');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { publicMedia, bareUpload } = require('../lib/present');

const router = express.Router();
router.use(requireAuth, requireCouple);

const MAX_STICKERS = 300;

function present(sticker) {
  return { id: sticker._id, mediaUrl: publicMedia(sticker.mediaUrl), createdAt: sticker.createdAt };
}

router.get('/', async (req, res, next) => {
  try {
    const stickers = await Sticker.find({ coupleId: req.couple._id }).sort({ createdAt: -1 }).limit(MAX_STICKERS);
    res.json(stickers.map(present));
  } catch (error) {
    next(error);
  }
});

// Save a sticker (pasted from WhatsApp, picked from the gallery, or one sent in the chat).
router.post('/', async (req, res, next) => {
  try {
    const mediaUrl = bareUpload(req.body.mediaUrl);
    if (!mediaUrl) return res.status(400).json({ error: 'Add an image for the sticker' });
    const existing = await Sticker.findOne({ coupleId: req.couple._id, mediaUrl });
    if (existing) return res.json(present(existing));
    const count = await Sticker.countDocuments({ coupleId: req.couple._id });
    if (count >= MAX_STICKERS) return res.status(400).json({ error: `You can keep up to ${MAX_STICKERS} stickers` });
    const sticker = await Sticker.create({ coupleId: req.couple._id, addedBy: req.user._id, mediaUrl });
    res.status(201).json(present(sticker));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const sticker = await Sticker.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!sticker) return res.status(404).json({ error: 'Sticker not found' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
