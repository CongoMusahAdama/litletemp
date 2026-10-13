function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return function limit(req, res, next) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const current = hits.get(ip);
    if (!current || current.reset <= now) {
      hits.set(ip, { count: 1, reset: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retry = Math.ceil((current.reset - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many attempts. Wait a moment and try again.' });
    }
    return next();
  };
}

module.exports = { rateLimit };
