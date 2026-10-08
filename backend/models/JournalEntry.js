const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 120 },
  text: { type: String, default: '', maxlength: 8000 },
  mood: { type: String, default: 'Happy' },
  color: { type: String, default: '#FBBF24' },
  textColor: { type: String, default: '#1a1a1a' },
  favorite: { type: Boolean, default: false },
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video', 'audio'] },
  }],
}, { timestamps: true });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
