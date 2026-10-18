const mongoose = require('mongoose');

// A card a couple wrote for one of the games.
const gameCardSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['same', 'know', 'turn', 'spicy', 'tod'], required: true },
  prompt: { type: String, required: true, maxlength: 80 },
  a: { type: String, required: true, maxlength: 200 },
  b: { type: String, default: '', maxlength: 80 },
}, { timestamps: true });

module.exports = mongoose.model('GameCard', gameCardSchema);
