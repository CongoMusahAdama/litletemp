const express = require('express');
const BucketItem = require('../models/BucketItem');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(item) {
  return {
    id: item._id,
    title: item.title,
    description: item.description,
    completed: item.completed,
    category: item.category,
    targetDate: item.targetDate || '',
    dateAdded: new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    authorId: item.authorId,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const items = await BucketItem.find({ coupleId: req.couple._id }).sort({ createdAt: -1 });
    res.json(items.map(present));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 160);
    const category = req.body.category;
    const allowed = ['travel', 'date', 'memory', 'personal', 'journal'];
    if (!title) return res.status(400).json({ error: 'A title is required' });
    const item = await BucketItem.create({
      coupleId: req.couple._id,
      authorId: req.user._id,
      title,
      description: String(req.body.description || '').slice(0, 1000),
      category: allowed.includes(category) ? category : 'personal',
      targetDate: req.body.targetDate ? String(req.body.targetDate).slice(0, 40) : undefined,
    });
    const payload = present(item);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('bucket:new', payload);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const item = await BucketItem.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (typeof req.body.completed === 'boolean') item.completed = req.body.completed;
    if (req.body.title !== undefined) item.title = String(req.body.title).trim().slice(0, 160);
    await item.save();
    const payload = present(item);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('bucket:updated', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await BucketItem.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('bucket:deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
