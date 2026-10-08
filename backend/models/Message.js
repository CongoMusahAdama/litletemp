const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, maxlength: 4000 },
  type: { type: String, enum: ['text', 'voice', 'image', 'video'], default: 'text' },
  mediaUrl: { type: String },
  replyToId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  readByPartner: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ coupleId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
