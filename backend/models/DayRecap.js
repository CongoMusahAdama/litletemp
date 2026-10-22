const mongoose = require('mongoose');

// One evening check-in per person per day: how the day felt and a few words about it.
const dayRecapSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true }, // the person's own calendar day, YYYY-MM-DD
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, required: true, maxlength: 1000 },
}, { timestamps: true });

dayRecapSchema.index({ coupleId: 1, day: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('DayRecap', dayRecapSchema);
