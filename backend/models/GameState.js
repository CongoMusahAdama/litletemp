const mongoose = require('mongoose');

const gameStateSchema = new mongoose.Schema({
  coupleId: { type: String, required: true, unique: true },
  state: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('GameState', gameStateSchema);
