const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { vapidPublicKey } = require('../lib/push');

const router = express.Router();

router.get('/key', async (_req, res, next) => {
  try {
    res.json({ publicKey: await vapidPublicKey() });
  } catch (error) {
    next(error);
  }
});

router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = String(req.body.endpoint || '');
    const p256dh = String(req.body.keys?.p256dh || '');
    const auth = String(req.body.keys?.auth || '');
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Missing push subscription' });
    }
    req.user.pushSubscriptions = (req.user.pushSubscriptions || []).filter((item) => item.endpoint !== endpoint);
    req.user.pushSubscriptions.push({ endpoint, p256dh, auth });
    await req.user.save();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
