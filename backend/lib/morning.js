const Couple = require('../models/Couple');
const User = require('../models/User');
const { deliver, iconFor } = require('./push');
const { withLock } = require('./lock');

async function sendMorningNotes() {
  const hour = new Date().getUTCHours();
  if (hour < 8 || hour > 11) return;
  await withLock('morning-notes', 14 * 60 * 1000, () => sendMorningBody());
}

async function sendMorningBody() {
  const today = new Date().toISOString().slice(0, 10);
  const couples = await Couple.find({ status: 'active', partner2: { $ne: null } });
  for (const couple of couples) {
    const first = await User.findById(couple.partner1);
    const second = await User.findById(couple.partner2);
    if (first && second) {
      await greet(first, second, today);
      await greet(second, first, today);
    }
  }
}

async function greet(user, partner, today) {
  if (user.lastMorningDate === today) return;
  if (user.notifications === false || !user.pushSubscriptions?.length) return;
  const name = partner.username || partner.name || 'love';
  user.lastMorningDate = today;
  await user.save();
  await deliver(user, {
    kind: 'morning',
    title: `Good morning ${name}`,
    body: 'A new day, just the two of you.',
    icon: iconFor(partner),
  });
}

module.exports = { sendMorningNotes, sendAwayNotes, sendEveningNotes };

// Evening check-in reminder for anyone who hasn't shared how their day went yet.
async function sendEveningNotes() {
  const DayRecap = require('../models/DayRecap');
  const today = new Date().toISOString().slice(0, 10);
  const couples = await Couple.find({ status: 'active', partner2: { $ne: null } });
  for (const couple of couples) {
    const recaps = await DayRecap.find({ coupleId: couple._id, day: today });
    const shared = new Set(recaps.map((recap) => String(recap.userId)));
    const people = await User.find({ _id: { $in: [couple.partner1, couple.partner2] } });
    for (const user of people) {
      if (shared.has(String(user._id))) continue;
      if (user.notifications === false || !user.pushSubscriptions?.length) continue;
      const partner = people.find((person) => String(person._id) !== String(user._id));
      const name = partner ? (partner.username || partner.name) : 'your person';
      const partnerShared = partner && shared.has(String(partner._id));
      await deliver(user, {
        kind: 'recap',
        title: '🌙 How was your day?',
        body: partnerShared
          ? `${name} already shared theirs. Share yours to read it.`
          : `Tell ${name} about your day. It only takes a minute.`,
        icon: partner ? iconFor(partner) : undefined,
      });
    }
  }
}

async function sendAwayNotes() {
  await withLock('away-notes', 14 * 60 * 1000, () => sendAwayBody());
}

async function sendAwayBody() {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const users = await User.find({
    coupleId: { $ne: null },
    lastSeenAt: { $lt: cutoff },
    lastAwayDate: { $ne: today },
    notifications: { $ne: false },
    'pushSubscriptions.0': { $exists: true },
  });
  for (const user of users) {
    const couple = await Couple.findById(user.coupleId);
    if (!couple || couple.status !== 'active' || !couple.partner2) continue;
    const partnerId = String(couple.partner1) === String(user._id) ? couple.partner2 : couple.partner1;
    const partner = partnerId ? await User.findById(partnerId) : null;
    const name = partner ? (partner.username || partner.name) : 'Your person';
    user.lastAwayDate = today;
    await user.save();
    await deliver(user, {
      kind: 'away',
      title: `${name} misses you`,
      body: 'It has been a day. Come back to your space.',
      icon: partner ? iconFor(partner) : undefined,
    });
  }
}
