const express = require('express');
const path = require('path');
const multer = require('multer');
const Upload = require('../models/Upload');
const { requireAuth } = require('../middleware/auth');

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
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();

// Upload a file → stored in MongoDB (persistent across deploys)
router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });

    const ext = path.extname(req.file.originalname).toLowerCase().slice(0, 8);
    const safe = ALLOWED.includes(ext) ? ext : '';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safe}`;
    const contentType = MIME_MAP[safe] || req.file.mimetype || 'application/octet-stream';

    await Upload.create({
      filename,
      contentType,
      data: req.file.buffer,
    });

    res.status(201).json({ url: `/uploads/${filename}` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
