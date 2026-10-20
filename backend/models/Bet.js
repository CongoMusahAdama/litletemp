const mongoose = require('mongoose');

// A couple's friendly bet on one match. No money: the loser owes the winner's prize.
const betSchema = new mongoose.Schema({
  coupleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Couple', required: true, index: true },
  matchId: { type: String, required: true },
  league: { type: String, required: true },
  match: {
    leagueName: String,
    leagueLogo: String,
    kickoff: Date,
    home: { id: String, name: String, logo: String },
    away: { id: String, name: String, logo: String },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  picks: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    homeGoals: { type: Number, min: 0, max: 20 },
    awayGoals: { type: Number, min: 0, max: 20 },
    prize: { type: String, maxlength: 200 },
    at: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['open', 'settled', 'void'], default: 'open', index: true },
  result: {
    homeScore: Number,
    awayScore: Number,
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
  },
  paid: { type: Boolean, default: false },
  settledAt: Date,
}, { timestamps: true });

betSchema.index({ coupleId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model('Bet', betSchema);
