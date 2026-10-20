const mongoose = require('mongoose');

// A sticker saved to the couple's shared collection (like WhatsApp's saved stickers).
const stickerSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true },
}, { timestamps: true });

stickerSchema.index({ coupleId: 1, mediaUrl: 1 }, { unique: true });

module.exports = mongoose.model('Sticker', stickerSchema);
