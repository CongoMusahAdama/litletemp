const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 120 },
  desc: { type: String, default: '', maxlength: 500 },
  emoji: { type: String, default: '🎁' },
}, { timestamps: true });

module.exports = mongoose.model('WishlistItem', wishlistSchema);
