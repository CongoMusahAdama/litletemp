const express = require('express');
const JournalEntry = require('../models/JournalEntry');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(entry) {
  return {
    id: entry._id,
    title: entry.title,
    text: entry.text,
    mood: entry.mood,
    color: entry.color,
    textColor: entry.textColor,
    favorite: entry.favorite,
    media: entry.media || [],
    image: entry.media?.[0]?.url || '',
    authorId: entry.authorId,
    date: new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    createdAt: entry.createdAt,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const query = { coupleId: req.couple._id };
    if (req.query.favorite === 'true') query.favorite = true;
    const entries = await JournalEntry.find(query).sort({ createdAt: -1 });
    res.json(entries.map(present));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'A title is required' });
    const entry = await JournalEntry.create({
      coupleId: req.couple._id,
      authorId: req.user._id,
      title,
      text: String(req.body.text || '').slice(0, 8000),
      mood: String(req.body.mood || 'Happy').slice(0, 40),
      color: String(req.body.color || '#FBBF24').slice(0, 20),
      textColor: String(req.body.textColor || '#1a1a1a').slice(0, 20),
      media: Array.isArray(req.body.media) ? req.body.media.slice(0, 8) : [],
    });
    const payload = present(entry);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('journal:new', payload);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (req.body.title !== undefined) entry.title = String(req.body.title).trim().slice(0, 120);
    if (req.body.text !== undefined) entry.text = String(req.body.text).slice(0, 8000);
    if (typeof req.body.favorite === 'boolean') entry.favorite = req.body.favorite;
    await entry.save();
    const payload = present(entry);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('journal:updated', payload);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await JournalEntry.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('journal:deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
