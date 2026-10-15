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
  if (!url.startsWith('/uploads/')) return res.status(404).json({ error: 'Photo not found' });
  res.json({ url });
});

module.exports = router;
