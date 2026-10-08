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

function cleanUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0, 20);
}

function usernameOk(value) {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

function sameName(left, right) {
  return cleanName(left).toLowerCase() === cleanName(right).toLowerCase();
}

function otherPartnerId(couple, userId) {
  return [couple.partner1, couple.partner2]
    .map((id) => (id ? String(id) : ''))
    .find((id) => id && id !== String(userId)) || '';
}

async function findUsername(username) {
  if (!username) return null;
  return User.findOne({ username });
}

function welcome(res, user, couple) {
  return res.status(200).json({
    token: signToken(user._id),
    returning: true,
    user: user.toPublic(),
    couple: presentCouple(couple, user),
  });
}

async function existingBond(myName, partnerName) {
  const people = await User.find({ coupleId: { $ne: null } }).sort({ updatedAt: -1 });
  let best = null;
  for (const person of people) {
    if (!sameName(person.name, myName)) continue;
    const couple = await Couple.findById(person.coupleId);
    if (!couple) continue;
    const otherId = otherPartnerId(couple, person._id);
    const other = otherId ? await User.findById(otherId) : null;
    const otherName = other?.name || couple.expectedPartnerName || '';
    if (!sameName(otherName, partnerName)) continue;
    const messages = await Message.countDocuments({ coupleId: couple._id });
    if (!best || messages > best.messages || (messages === best.messages && couple.updatedAt > best.couple.updatedAt)) {
      best = { user: person, couple, other, messages };
    }
  }
  return best;
}

router.get('/username', async (req, res, next) => {
  try {
    const username = cleanUsername(req.query.username);
    if (!usernameOk(username)) return res.json({ taken: false, valid: false });
    const user = await findUsername(username);
    res.json({ taken: Boolean(user), valid: true });
  } catch (error) {
    next(error);
  }
});

router.post('/start', async (req, res, next) => {
  try {
    const myName = cleanName(req.body.myName);
    const partnerName = cleanName(req.body.partnerName);
    const myUsername = cleanUsername(req.body.myUsername);
    const partnerUsername = cleanUsername(req.body.partnerUsername);
    if (!myName || !partnerName) {
      return res.status(400).json({ error: 'Both names are required' });
    }
    if (!usernameOk(myUsername) || !usernameOk(partnerUsername)) {
      return res.status(400).json({ error: 'Usernames need 3 to 20 letters or numbers' });
    }
    if (myUsername === partnerUsername) {
      return res.status(409).json({ error: 'Choose a different username from your partner' });
    }

    const me = await findUsername(myUsername);
    const them = await findUsername(partnerUsername);

    if (me && them && me.coupleId && String(me.coupleId) === String(them.coupleId)) {
      const couple = await Couple.findById(me.coupleId);
      if (couple) return welcome(res, me, couple);
    }

    if (me && me.coupleId && !them) {
      const couple = await Couple.findById(me.coupleId);
      const reserved = couple?.expectedPartnerUsername || '';
      const otherId = couple ? otherPartnerId(couple, me._id) : '';
      if (couple && !otherId && (!reserved || reserved === partnerUsername)) {
        couple.expectedPartnerName = partnerName;
        couple.expectedPartnerUsername = partnerUsername;
        await couple.save();
        return welcome(res, me, couple);
      }
    }

    const previous = await existingBond(myName, partnerName);
    if (previous) {
      if (me && String(me._id) !== String(previous.user._id)) {
        return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
      }
      if (them && (!previous.other || String(them._id) !== String(previous.other._id))) {
        return res.status(409).json({ error: 'That partner username is taken. Choose a different one.' });
      }
      if (previous.user.username && previous.user.username !== myUsername) {
        return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
      }
      if (previous.other?.username && previous.other.username !== partnerUsername) {
        return res.status(409).json({ error: 'That partner username is taken. Choose a different one.' });
      }
      previous.user.name = myName;
      previous.user.username = myUsername;
      await previous.user.save();
      if (previous.other) {
        previous.other.name = partnerName;
        previous.other.username = partnerUsername;
        await previous.other.save();
      }
      previous.couple.expectedPartnerName = partnerName;
      previous.couple.expectedPartnerUsername = partnerUsername;
      await previous.couple.save();
      return welcome(res, previous.user, previous.couple);
    }

    if (me) return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
    if (them) return res.status(409).json({ error: 'That partner username is taken. Choose a different one.' });

    const user = await User.create({ name: myName, username: myUsername });
    const inviteCode = await makeInviteCode();
    const couple = await Couple.create({
      partner1: user._id,
      expectedPartnerName: partnerName,
      expectedPartnerUsername: partnerUsername,
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
    if (error.code === 11000) {
      return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
    }
    next(error);
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const myName = cleanName(req.body.myName);
    const myUsername = cleanUsername(req.body.myUsername);
    const code = String(req.body.pairingCode || '').trim().toUpperCase();
    if (!myName || !usernameOk(myUsername) || !/^BOND-\d{4}$/.test(code)) {
      return res.status(400).json({ error: 'Enter your name, a username, and a pairing code' });
    }

    const couple = await Couple.findOne({ inviteCode: code });
    if (!couple) return res.status(404).json({ error: 'That pairing code was not found' });

    const people = await User.find({
      _id: { $in: [couple.partner1, couple.partner2].filter(Boolean) },
    });
    const byUsername = people.find((person) => person.username === myUsername);
    if (byUsername) return welcome(res, byUsername, couple);

    const unnamed = people.filter((person) => sameName(person.name, myName) && !person.username);
    if (unnamed.length === 1) {
      const clash = await findUsername(myUsername);
      if (clash) return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
      unnamed[0].username = myUsername;
      await unnamed[0].save();
      return welcome(res, unnamed[0], couple);
    }

    const outsider = await findUsername(myUsername);
    if (outsider) return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
    if (couple.partner2) return res.status(409).json({ error: 'This bond is already paired' });
    if (couple.expectedPartnerUsername && couple.expectedPartnerUsername !== myUsername) {
      return res.status(409).json({ error: 'This code is saved for a different username. Choose the username you were given.' });
    }
    if (couple.inviteExpiresAt && couple.inviteExpiresAt < new Date()) {
      return res.status(410).json({ error: 'That pairing code has expired' });
    }

    const user = await User.create({ name: myName, username: myUsername, coupleId: couple._id });
    couple.partner2 = user._id;
    couple.status = 'active';
    couple.expectedPartnerUsername = myUsername;
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
    if (error.code === 11000) {
      return res.status(409).json({ error: 'That username is taken. Choose a different one.' });
    }
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
