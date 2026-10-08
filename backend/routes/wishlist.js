const express = require('express');
const WishlistItem = require('../models/WishlistItem');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(item) {
  return {
    id: item._id,
    title: item.title,
    desc: item.desc,
    emoji: item.emoji,
    authorId: item.authorId,
    createdAt: item.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await WishlistItem.find({ coupleId: req.couple._id }).sort({ createdAt: -1 });
    res.json(items.map(present));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'A wish needs a title' });
    const item = await WishlistItem.create({
      coupleId: req.couple._id,
      authorId: req.user._id,
      title,
      desc: String(req.body.desc || '').slice(0, 500),
      emoji: String(req.body.emoji || '🎁').slice(0, 8),
    });
    const payload = present(item);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('wishlist:new', payload);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await WishlistItem.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!item) return res.status(404).json({ error: 'Wish not found' });
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('wishlist:deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
