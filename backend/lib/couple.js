const Couple = require('../models/Couple');
const { dayKey } = require('./present');

function yesterdayKey() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return dayKey(date);
}

function streakView(couple, userId) {
  const today = dayKey();
  const yesterday = yesterdayKey();
  const youAreFirst = String(couple.partner1) === String(userId);
  const youCheckedIn = (youAreFirst ? couple.partner1ActiveDate : couple.partner2ActiveDate) === today;
  const partnerCheckedIn = (youAreFirst ? couple.partner2ActiveDate : couple.partner1ActiveDate) === today;
  const last = couple.lastStreakDate || "";
  const savedToday = last === today;
  const stillAlive = last === today || last === yesterday;
  const stored = couple.currentStreak || 0;
  let state = "start";
  let streak = stored;
  if (stored > 0 && last && !stillAlive) {
    state = "lost";
    streak = 0;
  } else if (savedToday) {
    state = "saved";
  } else if (stored > 0 && stillAlive) {
    state = youCheckedIn && !partnerCheckedIn ? "waiting" : "expiring";
  }
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const hoursLeft = Math.max(1, Math.ceil((midnight.getTime() - Date.now()) / 3600000));
  return { streak, state, youCheckedIn, partnerCheckedIn, hoursLeft };
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

module.exports = { touchStreak, makeInviteCode, streakView };
