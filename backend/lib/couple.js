const Couple = require('../models/Couple');
const { dayKey } = require('./present');

function yesterdayKey() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return dayKey(date);
}

async function touchStreak(couple, userId) {
  const today = dayKey();
  const isFirst = String(couple.partner1) === String(userId);
  if (isFirst) couple.partner1ActiveDate = today;
  else couple.partner2ActiveDate = today;

  const bothToday = couple.partner1ActiveDate === today && couple.partner2ActiveDate === today;
  if (bothToday && couple.lastStreakDate !== today) {
    const continued = couple.lastStreakDate === yesterdayKey();
    couple.currentStreak = continued ? couple.currentStreak + 1 : 1;
    couple.lastStreakDate = today;
  }
  await couple.save();
  return couple.currentStreak;
}

async function makeInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BOND-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await Couple.exists({ inviteCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not create a pairing code');
}

module.exports = { touchStreak, makeInviteCode };
