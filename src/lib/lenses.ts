// Snapchat-style face lenses, drawn onto the camera canvas from MediaPipe face landmarks.

export type Point = { x: number; y: number };

export type FaceFrame = {
  /** Landmark in canvas pixels. */
  p: (index: number) => Point;
  /** Face width in pixels (cheek to cheek). */
  w: number;
  /** Head tilt in radians. */
  roll: number;
  /** Unit vector pointing to the screen-right of the face. */
  right: Point;
  /** Unit vector pointing up out of the top of the head. */
  up: Point;
  /** 0 when closed, around 0.1+ when the mouth is wide open. */
  mouthOpen: number;
};

export type Lens = {
  id: string;
  name: string;
  icon: string;
  draw?: (ctx: CanvasRenderingContext2D, face: FaceFrame, t: number) => void;
};

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// Landmark indices from the MediaPipe face mesh.
const L = {
  eyeOuterA: 33, eyeInnerA: 133, eyeInnerB: 362, eyeOuterB: 263,
  noseTip: 1, forehead: 10, chin: 152,
  lipTop: 13, lipBottom: 14,
  cheekA: 234, cheekB: 454,
  cheekPadA: 50, cheekPadB: 280,
};

export function buildFace(points: Point[]): FaceFrame {
  const p = (i: number) => points[i];
  const a = p(L.cheekA);
  const b = p(L.cheekB);
  const w = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const eyeA = mid(p(L.eyeOuterA), p(L.eyeInnerA));
  const eyeB = mid(p(L.eyeOuterB), p(L.eyeInnerB));
  let rx = eyeB.x - eyeA.x;
  let ry = eyeB.y - eyeA.y;
  const len = Math.hypot(rx, ry) || 1;
  rx /= len;
  ry /= len;
  // Mirrored front camera flips the eye order; keep "right" pointing right.
  if (rx < 0) {
    rx = -rx;
    ry = -ry;
  }
  const lips = p(L.lipTop);
  const lipsB = p(L.lipBottom);
  return {
    p,
    w,
    roll: Math.atan2(ry, rx),
    right: { x: rx, y: ry },
    up: { x: ry, y: -rx },
    mouthOpen: Math.hypot(lipsB.x - lips.x, lipsB.y - lips.y) / w,
  };
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Move from a point along the face's own axes, in face widths. */
function at(face: FaceFrame, from: Point, dx: number, dy: number): Point {
  return {
    x: from.x + face.right.x * dx * face.w + face.up.x * dy * face.w,
    y: from.y + face.right.y * dx * face.w + face.up.y * dy * face.w,
  };
}

function eyes(face: FaceFrame) {
  const a = mid(face.p(L.eyeOuterA), face.p(L.eyeInnerA));
  const b = mid(face.p(L.eyeOuterB), face.p(L.eyeInnerB));
  return a.x < b.x ? [a, b] : [b, a];
}

function cheeks(face: FaceFrame) {
  const a = face.p(L.cheekPadA);
  const b = face.p(L.cheekPadB);
  return a.x < b.x ? [a, b] : [b, a];
}

function emoji(ctx: CanvasRenderingContext2D, char: string, pos: Point, size: number, rotation: number) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rotation);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 0, 0);
  ctx.restore();
}

function ellipse(ctx: CanvasRenderingContext2D, pos: Point, rx: number, ry: number, rotation: number, fill: string | CanvasGradient) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function blush(ctx: CanvasRenderingContext2D, face: FaceFrame, color: string) {
  cheeks(face).forEach((cheek) => {
    const r = face.w * 0.13;
    const grad = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ellipse(ctx, cheek, r, r * 0.75, face.roll, grad);
  });
}

function ear(ctx: CanvasRenderingContext2D, face: FaceFrame, side: -1 | 1, opts: { dx: number; dy: number; rx: number; ry: number; tilt: number; outer: string; inner: string }) {
  const top = face.p(L.forehead);
  const pos = at(face, top, side * opts.dx, opts.dy);
  const rot = face.roll + side * opts.tilt;
  ellipse(ctx, pos, opts.rx * face.w, opts.ry * face.w, rot, opts.outer);
  ellipse(ctx, at(face, pos, 0, -0.02), opts.rx * face.w * 0.55, opts.ry * face.w * 0.7, rot, opts.inner);
}

export const LENSES: Lens[] = [
  { id: "none", name: "No lens", icon: "🙂" },
  {
    id: "hearts",
    name: "Heart Eyes",
    icon: "😍",
    draw(ctx, face, t) {
      const pulse = 1 + Math.sin(t / 180) * 0.08;
      eyes(face).forEach((eye) => emoji(ctx, "❤️", eye, face.w * 0.36 * pulse, face.roll));
      blush(ctx, face, "rgba(255,90,140,0.45)");
    },
  },
  {
    id: "puppy",
    name: "Puppy",
    icon: "🐶",
    draw(ctx, face) {
      const earStyle = { dx: 0.42, dy: 0.08, rx: 0.17, ry: 0.3, tilt: 0.5, outer: "#8B5A2B", inner: "#D9A066" };
      ear(ctx, face, -1, earStyle);
      ear(ctx, face, 1, earStyle);
      const nose = face.p(L.noseTip);
      ellipse(ctx, at(face, nose, 0, 0.02), face.w * 0.11, face.w * 0.075, face.roll, "#2b1a12");
      ellipse(ctx, at(face, nose, -0.03, 0.045), face.w * 0.03, face.w * 0.018, face.roll, "rgba(255,255,255,0.7)");
      if (face.mouthOpen > 0.06) {
        const lip = face.p(L.lipBottom);
        const len = Math.min(0.32, face.mouthOpen * 1.6);
        ellipse(ctx, at(face, lip, 0, -len / 2), face.w * 0.11, face.w * len * 0.6, face.roll, "#ff6f91");
      }
    },
  },
  {
    id: "bunny",
    name: "Bunny",
    icon: "🐰",
    draw(ctx, face) {
      const earStyle = { dx: 0.2, dy: 0.42, rx: 0.1, ry: 0.36, tilt: 0.18, outer: "#ffffff", inner: "#ffb6cf" };
      ear(ctx, face, -1, earStyle);
      ear(ctx, face, 1, earStyle);
      const nose = face.p(L.noseTip);
      ellipse(ctx, at(face, nose, 0, 0.01), face.w * 0.05, face.w * 0.035, face.roll, "#ff7aa8");
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, face.w * 0.008);
      ctx.lineCap = "round";
      [-1, 1].forEach((side) => {
        [-0.04, 0, 0.04].forEach((dy) => {
          const start = at(face, nose, side * 0.08, dy - 0.02);
          const end = at(face, nose, side * 0.34, dy * 2 - 0.02);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        });
      });
      ctx.restore();
      blush(ctx, face, "rgba(255,150,190,0.4)");
    },
  },
  {
    id: "flowers",
    name: "Flower Crown",
    icon: "🌸",
    draw(ctx, face) {
      const top = face.p(L.forehead);
      const flowers = ["🌸", "🌼", "🌺", "🌷", "🌺", "🌼", "🌸"];
      flowers.forEach((flower, i) => {
        const u = i / (flowers.length - 1) * 2 - 1;
        const pos = at(face, top, u * 0.52, 0.08 - u * u * 0.18);
        emoji(ctx, flower, pos, face.w * (i === 3 ? 0.24 : 0.19), face.roll + u * 0.5);
      });
    },
  },
  {
    id: "kiss",
    name: "Kisses",
    icon: "💋",
    draw(ctx, face, t) {
      blush(ctx, face, "rgba(255,70,120,0.5)");
      const chin = face.p(L.chin);
      for (let i = 0; i < 5; i += 1) {
        const phase = ((t / 2400) + i / 5) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const pos = at(face, chin, side * (0.45 + Math.sin(phase * 6 + i) * 0.08), phase * 1.4);
        ctx.globalAlpha = 1 - phase;
        emoji(ctx, i % 3 === 0 ? "💋" : "💕", pos, face.w * 0.16, face.roll);
        ctx.globalAlpha = 1;
      }
    },
  },
  {
    id: "shades",
    name: "Cool",
    icon: "😎",
    draw(ctx, face) {
      const [a, b] = eyes(face);
      emoji(ctx, "🕶️", at(face, mid(a, b), 0, 0.01), face.w * 0.95, face.roll);
    },
  },
  {
    id: "angel",
    name: "Angel",
    icon: "😇",
    draw(ctx, face, t) {
      const top = face.p(L.forehead);
      const halo = at(face, top, 0, 0.32 + Math.sin(t / 400) * 0.02);
      ctx.save();
      ctx.translate(halo.x, halo.y);
      ctx.rotate(face.roll);
      ctx.shadowColor = "rgba(255,215,90,0.9)";
      ctx.shadowBlur = face.w * 0.08;
      ctx.strokeStyle = "#ffd75a";
      ctx.lineWidth = face.w * 0.045;
      ctx.beginPath();
      ctx.ellipse(0, 0, face.w * 0.36, face.w * 0.09, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      blush(ctx, face, "rgba(255,200,220,0.35)");
    },
  },
  {
    id: "devil",
    name: "Devil",
    icon: "😈",
    draw(ctx, face) {
      const top = face.p(L.forehead);
      [-1, 1].forEach((side) => {
        const base = at(face, top, side * 0.24, 0.02);
        const tip = at(face, top, side * 0.36, 0.34);
        const baseA = at(face, base, -0.07, 0);
        const baseB = at(face, base, 0.07, 0);
        const grad = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
        grad.addColorStop(0, "#b3001b");
        grad.addColorStop(1, "#ff2d55");
        ctx.beginPath();
        ctx.moveTo(baseA.x, baseA.y);
        ctx.quadraticCurveTo((baseA.x + tip.x) / 2 - side * face.w * 0.05, (baseA.y + tip.y) / 2, tip.x, tip.y);
        ctx.quadraticCurveTo((baseB.x + tip.x) / 2, (baseB.y + tip.y) / 2, baseB.x, baseB.y);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      });
      blush(ctx, face, "rgba(255,30,60,0.35)");
    },
  },
  {
    id: "butterflies",
    name: "Butterflies",
    icon: "🦋",
    draw(ctx, face, t) {
      const top = face.p(L.forehead);
      const center = at(face, top, 0, -0.1);
      for (let i = 0; i < 4; i += 1) {
        const angle = t / 900 + (i * Math.PI) / 2;
        const pos = at(face, center, Math.cos(angle) * 0.62, Math.sin(angle) * 0.22 + 0.2);
        emoji(ctx, "🦋", pos, face.w * (0.14 + 0.04 * Math.sin(t / 150 + i)), face.roll + Math.sin(t / 200 + i) * 0.3);
      }
    },
  },
];
