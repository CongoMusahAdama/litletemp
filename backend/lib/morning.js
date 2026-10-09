const Couple = require('../models/Couple');
const User = require('../models/User');
const { deliver, iconFor } = require('./push');

async function sendMorningNotes() {
  const hour = new Date().getUTCHours();
  if (hour < 8 || hour > 11) return;
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

module.exports = { sendMorningNotes };
