// Colour filters applied after a snap is taken (swipe left/right, like Snapchat).
// The same maths as the CSS filter functions, so the saved photo matches the preview
// (canvas ctx.filter is missing on iPhone Safari).

export type Op = ["saturate" | "sepia" | "grayscale" | "brightness" | "contrast" | "hue", number];

export type SnapFilter = {
  id: string;
  name: string;
  swatch: string;
  ops: Op[];
  tint?: string;
  stickers?: { emoji: string; x: number; y: number; size: number }[];
  /** Snapchat-style text overlay. */
  label?: "time" | "date";
};

export const FILTERS: SnapFilter[] = [
  { id: "normal", name: "Normal", swatch: "linear-gradient(135deg,#f5f5f5,#d4d4d4)", ops: [] },
  { id: "warm", name: "Warm", swatch: "linear-gradient(135deg,#FDE68A,#F59E0B)", ops: [["sepia", 0.25], ["saturate", 1.3], ["brightness", 1.05]] },
  { id: "golden", name: "Golden", swatch: "linear-gradient(135deg,#FCD34D,#EA580C)", ops: [["sepia", 0.35], ["saturate", 1.4], ["contrast", 1.05]], tint: "rgba(255,190,80,0.12)" },
  { id: "love", name: "Love", swatch: "linear-gradient(135deg,#FBCFE8,#F43F5E)", ops: [["saturate", 1.25], ["brightness", 1.04]], tint: "rgba(255,90,140,0.14)",
    stickers: [{ emoji: "❤️", x: 0.12, y: 0.12, size: 0.11 }, { emoji: "💕", x: 0.84, y: 0.2, size: 0.09 }, { emoji: "💖", x: 0.8, y: 0.86, size: 0.1 }] },
  { id: "dreamy", name: "Dreamy", swatch: "linear-gradient(135deg,#E9D5FF,#F9A8D4)", ops: [["brightness", 1.12], ["saturate", 1.2], ["contrast", 0.9]], tint: "rgba(255,170,220,0.15)" },
  { id: "cool", name: "Cool", swatch: "linear-gradient(135deg,#BAE6FD,#3B82F6)", ops: [["saturate", 1.1], ["hue", -15], ["brightness", 1.05]], tint: "rgba(80,140,255,0.1)" },
  { id: "vintage", name: "Vintage", swatch: "linear-gradient(135deg,#E7D3B0,#92400E)", ops: [["sepia", 0.6], ["contrast", 1.1], ["brightness", 0.95], ["saturate", 0.8]] },
  { id: "bw", name: "B&W", swatch: "linear-gradient(135deg,#ffffff,#111111)", ops: [["grayscale", 1], ["contrast", 1.2]] },
  { id: "time", name: "Time", swatch: "linear-gradient(135deg,#111,#444)", ops: [["contrast", 1.05]], label: "time" },
  { id: "date", name: "Date", swatch: "linear-gradient(135deg,#FF4081,#7c3aed)", ops: [["saturate", 1.1]], label: "date" },
  { id: "noir", name: "Noir", swatch: "linear-gradient(135deg,#6b7280,#000000)", ops: [["grayscale", 1], ["contrast", 1.5], ["brightness", 0.9]] },
  // Streak rewards (see lib/rewards.ts).
  { id: "sparkle", name: "Sparkle", swatch: "linear-gradient(135deg,#FFF1F8,#FF4081)", ops: [["brightness", 1.1], ["saturate", 1.3], ["contrast", 1.05]], tint: "rgba(255,220,240,0.12)",
    stickers: [{ emoji: "✨", x: 0.14, y: 0.16, size: 0.1 }, { emoji: "✨", x: 0.86, y: 0.3, size: 0.07 }, { emoji: "💫", x: 0.82, y: 0.84, size: 0.09 }] },
  { id: "heat", name: "Heat", swatch: "linear-gradient(135deg,#FDBA74,#DC2626)", ops: [["sepia", 0.3], ["saturate", 1.6], ["hue", -12], ["contrast", 1.1]], tint: "rgba(255,80,40,0.14)",
    stickers: [{ emoji: "🔥", x: 0.12, y: 0.86, size: 0.12 }, { emoji: "🌶️", x: 0.86, y: 0.14, size: 0.09 }] },
  { id: "galaxy", name: "Galaxy", swatch: "linear-gradient(135deg,#4C1D95,#EC4899)", ops: [["hue", 25], ["saturate", 1.4], ["contrast", 1.1], ["brightness", 0.95]], tint: "rgba(120,60,220,0.18)",
    stickers: [{ emoji: "🌌", x: 0.85, y: 0.13, size: 0.1 }, { emoji: "⭐", x: 0.13, y: 0.22, size: 0.07 }, { emoji: "🪐", x: 0.84, y: 0.86, size: 0.1 }] },
  { id: "crown", name: "Crown", swatch: "linear-gradient(135deg,#FDE68A,#B45309)", ops: [["sepia", 0.25], ["saturate", 1.35], ["brightness", 1.06], ["contrast", 1.05]], tint: "rgba(255,200,80,0.12)",
    stickers: [{ emoji: "👑", x: 0.5, y: 0.1, size: 0.16 }, { emoji: "💖", x: 0.12, y: 0.86, size: 0.09 }, { emoji: "💖", x: 0.88, y: 0.86, size: 0.09 }] },
];

export function cssFilter(ops: Op[]) {
  if (!ops.length) return "none";
  return ops.map(([name, value]) => name === "hue" ? `hue-rotate(${value}deg)` : `${name}(${value})`).join(" ");
}

// Same maths as the CSS filter functions, so the sent photo matches the live preview
// (canvas ctx.filter is missing on iPhone Safari).
function opMatrix([name, v]: Op): number[] {
  if (name === "brightness") return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
  if (name === "contrast") {
    const off = (0.5 - 0.5 * v) * 255;
    return [v, 0, 0, off, 0, v, 0, off, 0, 0, v, off];
  }
  if (name === "saturate") {
    return [
      0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0,
      0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0,
    ];
  }
  if (name === "sepia") {
    const a = 1 - v;
    return [
      0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
      0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
      0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0,
    ];
  }
  if (name === "grayscale") {
    const a = 1 - v;
    return [
      0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0,
      0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0,
      0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0,
    ];
  }
  const rad = (v * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
  ];
}

function composeOps(ops: Op[]) {
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  ops.forEach((op) => {
    const o = opMatrix(op);
    const next: number[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        let value = 0;
        for (let k = 0; k < 3; k += 1) value += o[row * 4 + k] * m[k * 4 + col];
        if (col === 3) value += o[row * 4 + 3];
        next.push(value);
      }
    }
    m = next;
  });
  return m;
}

export function applyOps(ctx: CanvasRenderingContext2D, width: number, height: number, ops: Op[]) {
  if (!ops.length) return;
  const m = composeOps(ops);
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
    d[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
    d[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
  }
  ctx.putImageData(image, 0, 0);
}

export function labelText(label: "time" | "date", when: Date) {
  return label === "time"
    ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : when.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

/** Draw the filter onto a canvas that already holds the photo. */
export function paintFilter(ctx: CanvasRenderingContext2D, width: number, height: number, filter: SnapFilter, when: Date) {
  applyOps(ctx, width, height, filter.ops);
  if (filter.tint) {
    ctx.fillStyle = filter.tint;
    ctx.fillRect(0, 0, width, height);
  }
  filter.stickers?.forEach((sticker) => {
    const size = sticker.size * width;
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sticker.emoji, sticker.x * width, sticker.y * height);
  });
  if (filter.label) {
    const size = filter.label === "time" ? width * 0.16 : width * 0.075;
    ctx.font = `800 ${size}px Sora, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = size * 0.25;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText(filter.label, when), width / 2, height * 0.72);
    ctx.shadowBlur = 0;
  }
}
