const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { type: String, required: true },
  date: { type: String, required: true },
}, { timestamps: true });

moodSchema.index({ coupleId: 1, userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Mood', moodSchema);
