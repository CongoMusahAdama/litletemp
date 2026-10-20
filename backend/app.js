const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const chatRoutes = require('./routes/chat');
const journalRoutes = require('./routes/journal');
const moodRoutes = require('./routes/mood');
const wishlistRoutes = require('./routes/wishlist');
const bucketRoutes = require('./routes/bucket');
const storyRoutes = require('./routes/stories');
const uploadRoutes = require('./routes/uploads');
const pushRoutes = require('./routes/push');
const dailyRoutes = require('./routes/daily');
const nudgeRoutes = require('./routes/nudge');
const memoryRoutes = require('./routes/memories');
const gameRoutes = require('./routes/games');
const snapRoutes = require('./routes/snaps');
const footballRoutes = require('./routes/football');
const Upload = require('./models/Upload');
const { verifyUpload } = require('./lib/present');
const { log } = require('./lib/log');

function createApp() {
  const clientOrigin = process.env.CLIENT_ORIGIN || '*';
  const allowedOrigins = clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/uploads/:filename', async (req, res) => {
    try {
      const filename = decodeURIComponent(req.params.filename);
      if (!verifyUpload(filename, req.query.exp, req.query.sig)) {
        return res.status(401).end();
      }
      const doc = await Upload.findOne({ filename });
      if (!doc) return res.status(404).end();
      res.set('Content-Type', doc.contentType);
      // A filename's bytes never change, so the phone can keep it.
      res.set('Cache-Control', 'private, max-age=604800, immutable');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(doc.data);
    } catch (error) {
      log('error', 'upload read failed', { stack: error.stack });
      res.status(500).end();
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', pin: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/journal', journalRoutes);
  app.use('/api/moods', moodRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/bucket', bucketRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/daily', dailyRoutes);
  app.use('/api/nudge', nudgeRoutes);
  app.use('/api/memories', memoryRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/snaps', snapRoutes);
  app.use('/api/football', footballRoutes);

  app.use((error, req, res, _next) => {
    log('error', error.message || 'request failed', {
      code: error.code,
      status: error.status,
      path: req.path,
      stack: error.stack,
    });
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is larger than 12MB' });
    }
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

module.exports = { createApp };
