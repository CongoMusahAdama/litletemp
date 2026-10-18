const mongoose = require('mongoose');

const dailyAnswerSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },
  question: { type: String, required: true, maxlength: 200 },
  text: { type: String, required: true, maxlength: 600 },
}, { timestamps: true });

dailyAnswerSchema.index({ coupleId: 1, day: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('DailyAnswer', dailyAnswerSchema);
