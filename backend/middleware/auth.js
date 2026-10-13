const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Couple = require('../models/Couple');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

function signToken(userOrId) {
  const userId = userOrId && userOrId._id ? userOrId._id : userOrId;
  const version = userOrId && userOrId._id ? (userOrId.tokenVersion || 0) : 0;
  return jwt.sign({ userId: String(userId), v: version }, getSecret(), { expiresIn: '30d' });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Sign in required' });

    const payload = jwt.verify(token, getSecret());
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Account not found' });

    if ((payload.v || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Session expired. Sign in again.' });
    }
    req.user = user;
    if (user.coupleId) {
      req.couple = await Couple.findById(user.coupleId);
    }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Session expired. Pair again.' });
    }
    next(error);
  }
}

function requireCouple(req, res, next) {
  if (!req.couple) return res.status(409).json({ error: 'You are not paired yet' });
  next();
}

module.exports = { signToken, requireAuth, requireCouple, getSecret };
