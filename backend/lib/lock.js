const mongoose = require('mongoose');

const lockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lockedUntil: { type: Date, required: true },
});

const Lock = mongoose.models.JobLock || mongoose.model('JobLock', lockSchema);

async function withLock(name, ttlMs, fn) {
  const now = new Date();
  const until = new Date(Date.now() + ttlMs);
  const held = await Lock.findOneAndUpdate(
    { name, lockedUntil: { $lte: now } },
    { $set: { lockedUntil: until } }
  );
  if (!held) {
    try {
      await Lock.create({ name, lockedUntil: until });
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }
  await fn();
  return true;
}

module.exports = { withLock };
