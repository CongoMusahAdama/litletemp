const express = require('express');
const User = require('../models/User');
const Couple = require('../models/Couple');
const Message = require('../models/Message');
const { signToken, requireAuth } = require('../middleware/auth');
const { makeInviteCode } = require('../lib/couple');
const { presentCouple } = require('../lib/present');
const { getIo } = require('../socket');

const router = express.Router();

function cleanName(value) {
  return String(value || '').trim().slice(0, 40);
}

function sameName(left, right) {
  return cleanName(left).toLowerCase() === cleanName(right).toLowerCase();
}

async function existingBond(myName, partnerName) {
  const people = await User.find({ coupleId: { $ne: null } }).sort({ updatedAt: -1 });
  let best = null;
  for (const person of people) {
    if (!sameName(person.name, myName)) continue;
    const couple = await Couple.findById(person.coupleId);
    if (!couple) continue;
    const otherId = [couple.partner1, couple.partner2]
      .map((id) => (id ? String(id) : ''))
      .find((id) => id && id !== String(person._id));
    const other = otherId ? await User.findById(otherId) : null;
    const otherName = other?.name || couple.expectedPartnerName || '';
    if (!sameName(otherName, partnerName)) continue;
    const messages = await Message.countDocuments({ coupleId: couple._id });
    if (!best || messages > best.messages || (messages === best.messages && couple.updatedAt > best.couple.updatedAt)) {
      best = { user: person, couple, messages };
    }
  }
  return best;
}

router.post('/start', async (req, res, next) => {
  try {
    const myName = cleanName(req.body.myName);
    const partnerName = cleanName(req.body.partnerName);
    if (!myName || !partnerName) {
      return res.status(400).json({ error: 'Both names are required' });
    }

    const previous = await existingBond(myName, partnerName);
    if (previous) {
      return res.status(200).json({
        token: signToken(previous.user._id),
        returning: true,
        user: previous.user.toPublic(),
        couple: presentCouple(previous.couple, previous.user),
      });
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

    const people = await User.find({
      _id: { $in: [couple.partner1, couple.partner2].filter(Boolean) },
    });
    const matches = people.filter((person) => person.name.toLowerCase() === myName.toLowerCase());
    if (matches.length === 1) {
      const user = matches[0];
      return res.status(200).json({
        token: signToken(user._id),
        returning: true,
        user: user.toPublic(),
        couple: presentCouple(couple, user),
      });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Both names match. Use the name saved on your profile.' });
    }
    if (couple.inviteExpiresAt && couple.inviteExpiresAt < new Date()) {
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
