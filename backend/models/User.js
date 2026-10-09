const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  username: { type: String, trim: true, sparse: true, unique: true, maxlength: 32 },
  pinHash: { type: String },
  avatarUrl: { type: String },
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', index: true },
  notifications: { type: Boolean, default: true },
  language: { type: String, default: 'English' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  bubbleColor: { type: String, default: '#FBBF24' },
  pushSubscriptions: [{
    endpoint: String,
    p256dh: String,
    auth: String,
  }],
  lastMorningDate: { type: String, default: '' },
}, { timestamps: true });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    username: this.username || '',
    avatarUrl: this.avatarUrl || '',
    coupleId: this.coupleId,
    notifications: this.notifications,
    language: this.language,
    theme: this.theme,
    bubbleColor: this.bubbleColor || '#FBBF24',
    hasPin: Boolean(this.pinHash),
  };
};

module.exports = mongoose.model('User', userSchema);
