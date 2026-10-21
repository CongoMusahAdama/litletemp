const express = require('express');
const User = require('../models/User');
const { requireAuth, requireCouple } = require('../middleware/auth');
const { tokenRequest } = require('../lib/realtime');

const router = express.Router();
router.use(requireAuth, requireCouple);

// The phone asks for a short-lived token to join its live channels.
router.get('/token', async (req, res, next) => {
  try {
    const request = await tokenRequest(req.user._id, req.couple._id);
    if (!request) return res.status(503).json({ error: 'Live updates are not set up yet' });
    // "Last seen" used to update when the socket connected; it now updates here.
    User.updateOne({ _id: req.user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => undefined);
    res.json({ tokenRequest: request, userId: String(req.user._id), coupleId: String(req.couple._id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
