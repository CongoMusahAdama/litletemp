// Chat bubble colours earned through the streak. Keep in sync with src/lib/rewards.ts.
const REWARD_BUBBLES = {
  '#C2185B': 7,
  '#2D1B4E': 30,
  '#D4A017': 100,
};

function bubbleUnlocked(color, couple) {
  const needed = REWARD_BUBBLES[String(color).toUpperCase()];
  if (!needed) return true;
  const best = Math.max(couple?.bestStreak || 0, couple?.currentStreak || 0);
  return best >= needed;
}

module.exports = { REWARD_BUBBLES, bubbleUnlocked };
