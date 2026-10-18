// What the streak unlocks. Rewards are based on the best streak ever reached,
// so losing a streak never takes away something already earned.
// Bubble colours must match backend/lib/rewards.js.
export type Reward = {
  days: number;
  kind: "filter" | "bubble";
  id: string;
  name: string;
  emoji: string;
};

export const REWARDS: Reward[] = [
  { days: 3, kind: "filter", id: "sparkle", name: "Sparkle snap filter", emoji: "✨" },
  { days: 7, kind: "bubble", id: "#C2185B", name: "Ruby chat bubble", emoji: "💎" },
  { days: 14, kind: "filter", id: "heat", name: "Heat snap filter", emoji: "🌶️" },
  { days: 30, kind: "bubble", id: "#2D1B4E", name: "Midnight chat bubble", emoji: "🌙" },
  { days: 50, kind: "filter", id: "galaxy", name: "Galaxy snap filter", emoji: "🌌" },
  { days: 100, kind: "bubble", id: "#D4A017", name: "Gold chat bubble", emoji: "🏆" },
  { days: 365, kind: "filter", id: "crown", name: "Crown snap filter", emoji: "👑" },
];

export function unlockDay(kind: Reward["kind"], id: string) {
  return REWARDS.find((reward) => reward.kind === kind && reward.id.toLowerCase() === id.toLowerCase())?.days || 0;
}
