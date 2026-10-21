const express = require('express');
const path = require('path');
const multer = require('multer');
const Upload = require('../models/Upload');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../lib/limit');
const { publicMedia } = require('../lib/present');

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.m4a', '.mp3', '.ogg', '.wav'];

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

// Use memory storage instead of disk so files go straight to MongoDB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED.includes(ext)) {
      const error = new Error('That file type is not allowed');
      error.status = 400;
      cb(error);
      return;
    }
    cb(null, true);
  },
});

const router = express.Router();

// Upload a file → stored in MongoDB (persistent across deploys)
router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, max: 40 }), requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext) || !MIME_MAP[ext]) {
      return res.status(400).json({ error: 'That file type is not allowed' });
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const contentType = MIME_MAP[ext];

    await Upload.create({
      filename,
      contentType,
      data: req.file.buffer,
    });

    res.status(201).json({ url: publicMedia(`/uploads/${filename}`) });
  } catch (error) {
    next(error);
  }
});

router.post('/link', requireAuth, (req, res) => {
  const url = publicMedia(req.body?.url || '');
  if (!url.startsWith('/uploads/') && !url.startsWith('https://')) return res.status(404).json({ error: 'Photo not found' });
  res.json({ url });
});

// Direct-to-storage uploads (Vercel Blob). Vercel caps a request at 4.5MB, so the
// phone sends the file straight to Blob; this endpoint only checks who is asking
// and hands out a one-time upload token.
const BLOB_TYPES = Object.values(MIME_MAP).concat(['video/x-m4v', 'audio/webm', 'audio/x-m4a', 'audio/aac']);
const BLOB_MAX_BYTES = 60 * 1024 * 1024;

router.post('/blob', async (req, res) => {
  try {
    const { handleUpload } = require('@vercel/blob/client');
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const { getSecret } = require('../middleware/auth');
    const result = await handleUpload({
      body: req.body,
      request: { headers: new Headers(Object.entries(req.headers).map(([key, value]) => [key, String(value)])) },
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // The app passes its sign-in token as the payload.
        const payload = jwt.verify(String(clientPayload || ''), getSecret());
        const user = await User.findById(payload.userId);
        if (!user || (payload.v || 0) !== (user.tokenVersion || 0)) throw new Error('Sign in required');
        return {
          allowedContentTypes: BLOB_TYPES,
          maximumSizeInBytes: BLOB_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: String(user._id),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Upload failed' });
  }
});

module.exports = router;
