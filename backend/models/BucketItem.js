const mongoose = require('mongoose');

const bucketSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 1000 },
  completed: { type: Boolean, default: false },
  category: { type: String, enum: ['travel', 'date', 'memory', 'personal', 'journal'], default: 'personal' },
  targetDate: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('BucketItem', bucketSchema);
