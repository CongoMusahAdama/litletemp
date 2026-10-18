const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Couple = require('../models/Couple');
const Message = require('../models/Message');
const { signToken, requireAuth } = require('../middleware/auth');
const { makeInviteCode } = require('../lib/couple');
const { presentCouple } = require('../lib/present');
const { getIo } = require('../socket');
const { rateLimit } = require('../lib/limit');

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loginKey(value) {
  return cleanName(value).toLowerCase();
}

async function findByLoginName(value) {
  const key = loginKey(value);
  const typed = cleanName(value);
  if (key.length < 2) return null;
  return User.findOne({
    $or: [
      { username: key },
      { name: new RegExp(`^${escapeRegex(typed)}$`, 'i') },
    ],
  });
}

async function findUsername(username) {
  if (!username) return null;
  return User.findOne({ username });
}

function welcome(res, user, couple) {
  return res.status(200).json({
    token: signToken(user),
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

router.post('/start', (_req, res) => {
  res.status(410).json({ error: 'Pairing now uses an ID and password. Choose Show my ID or Connect.' });
});

router.post('/join', (_req, res) => {
  res.status(410).json({ error: 'Pairing now uses an ID and password. Choose Show my ID or Connect.' });
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
    await User.updateOne({ _id: req.user._id }, { $set: { lastSeenAt: new Date() } });
    res.json({
      user: req.user.toPublic(),
      couple: req.couple ? presentCouple(req.couple, req.user) : null,
      partner: partner ? partner.toPublic() : null,
    });
  } catch (error) {
    next(error);
  }
});

async function makeAccessId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const accessId = String(Math.floor(100000000 + Math.random() * 900000000));
    const exists = await User.exists({ accessId });
    if (!exists) return accessId;
  }
  throw new Error('Could not create an ID');
}

function makeGatePassword() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

router.post('/host', rateLimit({ windowMs: 60 * 60 * 1000, max: 8 }), async (req, res, next) => {
  try {
    const myName = cleanName(req.body.name || req.body.myName);
    if (loginKey(myName).length < 2) return res.status(400).json({ error: 'Enter your name' });
    if (await findByLoginName(myName)) return res.status(409).json({ error: 'That name is already used. Choose another.' });
    const accessId = await makeAccessId();
    const gatePassword = makeGatePassword();
    const user = await User.create({ name: myName, username: loginKey(myName), accessId });
    const couple = await Couple.create({
      partner1: user._id,
      inviteCode: await makeInviteCode(),
      inviteExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      gatePassword,
      status: 'pending',
    });
    user.coupleId = couple._id;
    await user.save();
    res.status(201).json({
      token: signToken(user),
      user: user.toPublic(),
      couple: presentCouple(couple, user),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That name is already used. Choose another.' });
    next(error);
  }
});

router.post('/connect', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), async (req, res, next) => {
  try {
    const myName = cleanName(req.body.name || req.body.myName);
    const accessId = String(req.body.accessId || req.body.partnerId || '').replace(/\D/g, '');
    const password = String(req.body.password || '').replace(/\D/g, '');
    if (loginKey(myName).length < 2 || !/^\d{9}$/.test(accessId) || !/^\d{4,6}$/.test(password)) {
      return res.status(400).json({ error: 'Enter your name, your partner’s ID, and the password they showed you' });
    }
    const host = await User.findOne({ accessId });
    if (!host || !host.coupleId) return res.status(404).json({ error: 'That ID was not found' });
    const couple = await Couple.findById(host.coupleId);
    if (!couple) return res.status(404).json({ error: 'That ID was not found' });
    if (couple.partner2 || couple.status === 'active') {
      return res.status(409).json({ error: 'This ID is already paired. Sign in with your name and password.' });
    }
    if (await findByLoginName(myName)) {
      return res.status(409).json({ error: 'That name is already used. Choose another.' });
    }
    if (couple.gatePassword !== password) {
      return res.status(401).json({ error: 'That password does not match. Ask your partner to read it again.' });
    }
    const partner = await User.create({
      name: myName,
      username: loginKey(myName),
      accessId: await makeAccessId(),
      coupleId: couple._id,
    });
    const updated = await Couple.findOneAndUpdate(
      { _id: couple._id, status: 'pending', partner2: null, gatePassword: password },
      { $set: { partner2: partner._id, status: 'active', expectedPartnerName: myName, gatePassword: '' } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      await User.deleteOne({ _id: partner._id });
      return res.status(409).json({ error: 'This ID is already paired. Sign in with your name and password.' });
    }
    const io = getIo();
    if (io) {
      const payload = {
        partner: partner.toPublic(),
        couple: presentCouple(updated, host),
      };
      io.to(`couple:${couple._id}`).emit('partner:joined', payload);
      io.to(`user:${host._id}`).emit('partner:joined', payload);
    }
    res.status(200).json({
      token: signToken(partner),
      user: partner.toPublic(),
      couple: presentCouple(updated, partner),
      partner: host.toPublic(),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That name is already used. Choose another.' });
    next(error);
  }
});

router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), async (req, res, next) => {
  try {
    const loginName = cleanName(req.body.name || req.body.username);
    const password = String(req.body.password || '').trim();
    if (loginKey(loginName).length < 2 || !password) {
      return res.status(400).json({ error: 'Enter your name and password' });
    }
    const user = await findByLoginName(loginName);
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Name or password is incorrect' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Name or password is incorrect' });
    const couple = user.coupleId ? await Couple.findById(user.coupleId) : null;
    if (!couple) return res.status(403).json({ error: 'Account is not paired yet' });
    return welcome(res, user, couple);
  } catch (error) {
    next(error);
  }
});

// Forgot password: prove who you are by naming your partner, then choose a new password.
router.post('/forgot', rateLimit({ windowMs: 15 * 60 * 1000, max: 8 }), async (req, res, next) => {
  try {
    const loginName = cleanName(req.body.name);
    const partnerName = cleanName(req.body.partnerName).replace(/^@/, '');
    const password = String(req.body.password || '').trim();
    if (loginKey(loginName).length < 2 || loginKey(partnerName).length < 2) {
      return res.status(400).json({ error: "Enter your name and your partner's name" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const user = await findByLoginName(loginName);
    const couple = user?.coupleId ? await Couple.findById(user.coupleId) : null;
    const partnerId = couple ? otherPartnerId(couple, user._id) : '';
    const partner = partnerId ? await User.findById(partnerId) : null;
    const matches = partner && (sameName(partner.name, partnerName) || sameName(partner.username, partnerName));
    if (!user || !couple || !matches) {
      return res.status(401).json({ error: "Those names don't match a pair. Check the spelling and try again." });
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return welcome(res, user, couple);
  } catch (error) {
    next(error);
  }
});

// Set / update password (requires valid token)
router.post('/set-password', requireAuth, async (req, res, next) => {
  try {
    const password = String(req.body.password || '').trim();
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const hash = await bcrypt.hash(password, 10);
    req.user.passwordHash = hash;
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    res.json({ ok: true, token: signToken(req.user), user: req.user.toPublic() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
