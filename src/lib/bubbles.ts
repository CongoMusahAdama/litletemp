export const BUBBLES = [
  { id: "yellow", color: "#FBBF24", ink: "#1a1a1a" },
  { id: "green", color: "#128C7E", ink: "#ffffff" },
  { id: "mint", color: "#D8F3DC", ink: "#1a1a1a" },
  { id: "indigo", color: "#3C3489", ink: "#ffffff" },
  { id: "lavender", color: "#E6E0F5", ink: "#1a1a1a" },
  { id: "purple", color: "#7B2D8E", ink: "#ffffff" },
  { id: "lilac", color: "#F3D9F5", ink: "#1a1a1a" },
  { id: "coral", color: "#E86A58", ink: "#ffffff" },
  { id: "peach", color: "#F8D7C8", ink: "#1a1a1a" },
  { id: "teal", color: "#0E6B56", ink: "#ffffff" },
  { id: "aqua", color: "#D2F4F0", ink: "#1a1a1a" },
  { id: "blue", color: "#2F6FED", ink: "#ffffff" },
  { id: "sky", color: "#D7E6F5", ink: "#1a1a1a" },
  { id: "navy", color: "#1A365D", ink: "#ffffff" },
  { id: "ice", color: "#E7F0F7", ink: "#1a1a1a" },
  { id: "forest", color: "#24352C", ink: "#ffffff" },
  { id: "sage", color: "#E4F0E3", ink: "#1a1a1a" },
  { id: "wine", color: "#6B2030", ink: "#ffffff" },
  { id: "pink", color: "#F6D5DE", ink: "#1a1a1a" },
  { id: "black", color: "#1C1C1E", ink: "#ffffff" },
  { id: "gray", color: "#D5D5DB", ink: "#1a1a1a" },
  { id: "ocean", color: "#3B82C4", ink: "#ffffff" },
  { id: "powder", color: "#D9E8F2", ink: "#1a1a1a" },
  { id: "charcoal", color: "#3A3A3C", ink: "#ffffff" },
  { id: "silver", color: "#E5E5EA", ink: "#1a1a1a" },
  { id: "azure", color: "#3BA3E8", ink: "#ffffff" },
  { id: "pale", color: "#E4EEF6", ink: "#1a1a1a" },
  { id: "brown", color: "#8C6246", ink: "#ffffff" },
  { id: "cream", color: "#F6E7D8", ink: "#1a1a1a" },
  { id: "sand", color: "#C4A574", ink: "#1a1a1a" },
  { id: "ivory", color: "#F7F1E8", ink: "#1a1a1a" },
  { id: "emerald", color: "#1F9D55", ink: "#ffffff" },
];

export function applyBubble(color?: string) {
  const match = BUBBLES.find((item) => item.color.toLowerCase() === (color || "").toLowerCase()) || BUBBLES[0];
  document.documentElement.style.setProperty("--bubble-out", match.color);
  document.documentElement.style.setProperty("--bubble-ink", match.ink);
  localStorage.setItem("lt_bubble", match.color);
  return match;
}
