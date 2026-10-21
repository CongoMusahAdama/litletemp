const express = require('express');
const GameCard = require('../models/GameCard');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { KINDS } = require('../lib/gameDecks');
const { startGame, currentGame, clearGame, moveGame, viewGame, touchPlayer } = require('../lib/games');
const { getIo } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireCouple);

const MAX_CARDS = 100;

// Play a game: start, move, leave, or sync (join the current round).
// Both phones then get their own view through the live channel.
router.post('/play', async (req, res, next) => {
  try {
    const coupleId = req.couple._id;
    const userId = req.user._id;
    const action = String(req.body.action || '');
    if (action === 'start') await startGame(coupleId, req.body.value, userId);
    else if (action === 'move') await moveGame(coupleId, userId, req.body.value || {});
    else if (action === 'leave') await clearGame(coupleId);
    else if (action === 'sync') {
      const existing = await currentGame(coupleId);
      if (existing) {
        touchPlayer(existing, userId);
        await moveGame(coupleId, userId, {});
      }
    } else {
      return res.status(400).json({ error: 'Unknown game action' });
    }
    const state = await currentGame(coupleId);
    const io = getIo();
    [req.couple.partner1, req.couple.partner2].filter(Boolean).forEach((id) => {
      io.to(`user:${id}`).emit('game:state', state ? viewGame(state, id) : null);
    });
    res.json(state ? viewGame(state, userId) : null);
  } catch (error) {
    next(error);
  }
});

function present(card, viewerId) {
  return {
    id: card._id,
    kind: card.kind,
    prompt: card.prompt,
    a: card.a,
    b: card.b || '',
    mine: String(card.authorId) === String(viewerId),
  };
}

router.get('/cards', async (req, res, next) => {
  try {
    const kind = String(req.query.kind || '');
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown game' });
    const cards = await GameCard.find({ coupleId: req.couple._id, kind }).sort({ createdAt: -1 });
    res.json(cards.map((card) => present(card, req.user._id)));
  } catch (error) {
    next(error);
  }
});

router.post('/cards', async (req, res, next) => {
  try {
    const kind = String(req.body.kind || '');
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown game' });
    const choices = kind === 'same' || kind === 'know';
    const prompt = String(req.body.prompt || '').trim().slice(0, 80);
    const a = String(req.body.a || '').trim().slice(0, choices ? 80 : 200);
    const b = choices ? String(req.body.b || '').trim().slice(0, 80) : '';
    if (!a || (choices && (!prompt || !b))) {
      return res.status(400).json({ error: choices ? 'Add a question and both choices' : 'Write the card first' });
    }
    const count = await GameCard.countDocuments({ coupleId: req.couple._id, kind });
    if (count >= MAX_CARDS) return res.status(400).json({ error: `You can keep up to ${MAX_CARDS} cards per game` });
    const card = await GameCard.create({
      coupleId: req.couple._id,
      authorId: req.user._id,
      kind,
      prompt: kind === 'spicy' || kind === 'tod' ? (prompt === 'Dare' ? 'Dare' : 'Truth') : (prompt || 'Ours'),
      a,
      b,
    });
    res.status(201).json(present(card, req.user._id));
  } catch (error) {
    next(error);
  }
});

router.delete('/cards/:id', async (req, res, next) => {
  try {
    const card = await GameCard.findOneAndDelete({ _id: req.params.id, coupleId: req.couple._id });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
