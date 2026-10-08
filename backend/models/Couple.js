const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema({
  partner1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partner2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expectedPartnerName: { type: String, trim: true, maxlength: 40 },
  inviteCode: { type: String, required: true, unique: true, index: true },
  inviteExpiresAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  anniversary: { type: Date },
  currentStreak: { type: Number, default: 0 },
  lastStreakDate: { type: String },
  partner1ActiveDate: { type: String },
  partner2ActiveDate: { type: String },
  wallpaperUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Couple', coupleSchema);
