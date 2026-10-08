const express = require('express');
const User = require('../models/User');
const Couple = require('../models/Couple');
const { signToken, requireAuth } = require('../middleware/auth');
const { makeInviteCode } = require('../lib/couple');
const { presentCouple } = require('../lib/present');
const { getIo } = require('../socket');

const router = express.Router();

function cleanName(value) {
  return String(value || '').trim().slice(0, 40);
}

router.post('/start', async (req, res, next) => {
  try {
    const myName = cleanName(req.body.myName);
    const partnerName = cleanName(req.body.partnerName);
    if (!myName || !partnerName) {
      return res.status(400).json({ error: 'Both names are required' });
    }

    const user = await User.create({ name: myName });
    const inviteCode = await makeInviteCode();
    const couple = await Couple.create({
      partner1: user._id,
      expectedPartnerName: partnerName,
      inviteCode,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    user.coupleId = couple._id;
    await user.save();

    res.status(201).json({
      token: signToken(user._id),
      user: user.toPublic(),
      couple: presentCouple(couple, user),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const myName = cleanName(req.body.myName);
    const code = String(req.body.pairingCode || '').trim().toUpperCase();
    if (!myName || !/^BOND-\d{4}$/.test(code)) {
      return res.status(400).json({ error: 'Enter your name and a pairing code' });
    }

    const couple = await Couple.findOne({ inviteCode: code });
    if (!couple) return res.status(404).json({ error: 'That pairing code was not found' });
    if (couple.inviteExpiresAt < new Date()) {
      return res.status(410).json({ error: 'That pairing code has expired' });
    }
    if (couple.partner2) return res.status(409).json({ error: 'This bond is already paired' });

    const user = await User.create({ name: myName, coupleId: couple._id });
    couple.partner2 = user._id;
    couple.status = 'active';
    await couple.save();

    const creator = await User.findById(couple.partner1);
    const io = getIo();
    if (io) {
      io.to(`couple:${couple._id}`).emit('partner:joined', {
        partner: user.toPublic(),
        couple: presentCouple(couple, creator || user),
      });
    }

    res.status(200).json({
      token: signToken(user._id),
      user: user.toPublic(),
      couple: {
        ...presentCouple(couple, user),
        partner: creator ? creator.toPublic() : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    let partner = null;
    if (req.couple) {
      const selfId = String(req.user._id);
      const partnerId = [req.couple.partner1, req.couple.partner2]
        .map((id) => (id ? String(id) : ''))
        .find((id) => id && id !== selfId);
      if (partnerId) partner = await User.findById(partnerId);
    }
    res.json({
      user: req.user.toPublic(),
      couple: req.couple ? presentCouple(req.couple, req.user) : null,
      partner: partner ? partner.toPublic() : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
