const express = require('express');
const Story = require('../models/Story');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(story, viewerId) {
  return {
    id: story._id,
    authorId: story.authorId,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    expiresAt: story.expiresAt,
    seen: story.seenBy.some((id) => String(id) === String(viewerId)),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const stories = await Story.find({
      coupleId: req.couple._id,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    res.json(stories.map((story) => present(story, req.user._id)));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const mediaUrl = String(req.body.mediaUrl || '').slice(0, 500);
    if (!mediaUrl) return res.status(400).json({ error: 'A photo or video is required' });
    const story = await Story.create({
      coupleId: req.couple._id,
      authorId: req.user._id,
      mediaUrl,
      mediaType: req.body.mediaType === 'video' ? 'video' : 'image',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const payload = present(story, req.user._id);
    const io = getIo();
    if (io) io.to(`couple:${req.couple._id}`).emit('story:new', payload);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/seen', async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, coupleId: req.couple._id });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (!story.seenBy.some((id) => String(id) === String(req.user._id))) {
      story.seenBy.push(req.user._id);
      await story.save();
    }
    res.json(present(story, req.user._id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
