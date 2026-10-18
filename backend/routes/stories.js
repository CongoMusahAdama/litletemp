const express = require('express');
const Story = require('../models/Story');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { getIo } = require('../socket');
const { publicMedia, bareUpload } = require('../lib/present');
const { saveMessage } = require('../lib/messages');

const REACTIONS = ['❤️', '😍', '😂', '😮', '😢', '🔥'];

const router = express.Router();
router.use(requireAuth, requireCouple);

function present(story, viewerId) {
  const me = String(viewerId);
  return {
    id: story._id,
    authorId: story.authorId,
    mediaUrl: publicMedia(story.mediaUrl),
    mediaType: story.mediaType,
    expiresAt: story.expiresAt,
    seen: story.seenBy.some((id) => String(id) === me),
    liked: (story.likes || []).some((id) => String(id) === me),
    likeCount: (story.likes || []).length,
    reactions: (story.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      name: reaction.name || '',
      mine: String(reaction.userId) === me,
    })),
    myReaction: (story.reactions || []).find((reaction) => String(reaction.userId) === me)?.emoji || '',
    comments: (story.comments || []).map((comment) => ({
      id: comment._id,
      name: comment.name || '',
      text: comment.text,
      mine: String(comment.userId) === me,
    })),
  };
}

function pushStory(req, story) {
  const payload = present(story, req.user._id);
  const io = getIo();
  if (io) io.to(`couple:${req.couple._id}`).emit('story:updated', payload);
  return payload;
}

// Replies to the partner's story also land in the chat, so the author actually sees them.
function tellAuthor(req, story, text) {
  if (String(story.authorId) === String(req.user._id)) return;
  saveMessage(req.user, req.couple, { type: 'text', text }).catch(() => undefined);
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
    const mediaUrl = bareUpload(req.body.mediaUrl);
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

router.post('/:id/like', async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, coupleId: req.couple._id, expiresAt: { $gt: new Date() } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const me = String(req.user._id);
    const already = (story.likes || []).some((id) => String(id) === me);
    story.likes = already
      ? story.likes.filter((id) => String(id) !== me)
      : [...(story.likes || []), req.user._id];
    await story.save();
    res.json(pushStory(req, story));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 200);
    if (!text) return res.status(400).json({ error: 'Write a comment' });
    const story = await Story.findOne({ _id: req.params.id, coupleId: req.couple._id, expiresAt: { $gt: new Date() } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    story.comments.push({
      userId: req.user._id,
      name: req.user.username || req.user.name,
      text,
    });
    await story.save();
    tellAuthor(req, story, `Replied to your story: "${text}"`);
    res.status(201).json(pushStory(req, story));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/react', async (req, res, next) => {
  try {
    const emoji = String(req.body.emoji || '');
    if (!REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Pick a reaction' });
    const story = await Story.findOne({ _id: req.params.id, coupleId: req.couple._id, expiresAt: { $gt: new Date() } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    const me = String(req.user._id);
    const previous = (story.reactions || []).find((reaction) => String(reaction.userId) === me);
    story.reactions = (story.reactions || []).filter((reaction) => String(reaction.userId) !== me);
    const added = !previous || previous.emoji !== emoji;
    if (added) story.reactions.push({ userId: req.user._id, name: req.user.username || req.user.name, emoji });
    await story.save();
    if (added) tellAuthor(req, story, `Reacted ${emoji} to your story`);
    res.json(pushStory(req, story));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
