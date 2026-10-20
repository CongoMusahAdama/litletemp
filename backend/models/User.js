const mongoose = require('mongoose');
const { publicMedia } = require('../lib/present');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  username: { type: String, trim: true, sparse: true, unique: true, maxlength: 40 },
  accessId: { type: String, trim: true, sparse: true, unique: true, maxlength: 9 },
  pinHash: { type: String },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', index: true },
  notifications: { type: Boolean, default: true },
  language: { type: String, default: 'English' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  bubbleColor: { type: String, default: '#FF4081' },
  favoriteTeam: {
    id: String,
    name: String,
    logo: String,
    league: String,
  },
  pushSubscriptions: [{
    endpoint: String,
    p256dh: String,
    auth: String,
  }],
  lastMorningDate: { type: String, default: '' },
  lastAwayDate: { type: String, default: '' },
  lastSeenAt: { type: Date },
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    username: this.username || '',
    accessId: this.accessId || '',
    avatarUrl: publicMedia(this.avatarUrl),
    coupleId: this.coupleId,
    notifications: this.notifications,
    language: this.language,
    theme: this.theme,
    bubbleColor: this.bubbleColor || '#FF4081',
    favoriteTeam: this.favoriteTeam?.id
      ? { id: this.favoriteTeam.id, name: this.favoriteTeam.name, logo: this.favoriteTeam.logo, league: this.favoriteTeam.league }
      : null,
    hasPin: Boolean(this.pinHash),
    hasPassword: Boolean(this.passwordHash),
  };
};

module.exports = mongoose.model('User', userSchema);
