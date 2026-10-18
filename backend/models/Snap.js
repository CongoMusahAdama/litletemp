const mongoose = require('mongoose');

// A snap saved to someone's Memories (like Snapchat Memories). Private to its author.
const snapSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mediaUrl: { type: String, required: true },
  sentCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Snap', snapSchema);
