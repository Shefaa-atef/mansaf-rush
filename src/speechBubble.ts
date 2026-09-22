import type { Lang } from './i18n';

// The little speech bubble that pops up above a bot's head. Kept free of
// three.js so it is just "draw this text into a canvas".

export type BubbleKind = 'eat' | 'missed';

// The canvas is 560x228; the sprite in OpponentEffects keeps that aspect.
export const BUBBLE_W = 560;
export const BUBBLE_H = 228;

/** Where the pieces sit on the canvas. Exported so tests can probe the shape. */
export const BUBBLE = {
  x: 28,
  y: 20,
  w: BUBBLE_W - 56,
  h: 138,
  radius: 46,
  tailHalf: 26, // half the pointer's width where it joins the body
  tailHeight: 34, // how far the pointer sticks out below the body
} as const;

const FONT = 'Changa, Nunito, Arial';

/**
 * Traces the whole bubble as ONE closed outline: a rounded rectangle whose
 * bottom edge dips into a triangular pointer. Because body and pointer are a
 * single path they share one fill, one shadow and one stroke, so there is no
 * line left between the rectangle and the triangle.
 */
function traceBubble(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h, radius, tailHalf, tailHeight } = BUBBLE;
  const right = x + w,
    bottom = y + h,
    mid = BUBBLE_W / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(right, y, right, bottom, radius); // top edge into top-right corner
  ctx.arcTo(right, bottom, mid + tailHalf, bottom, radius); // right edge into bottom-right corner
  ctx.lineTo(mid + tailHalf, bottom); // bottom edge, right of the pointer
  ctx.lineTo(mid, bottom + tailHeight); // down to the tip
  ctx.lineTo(mid - tailHalf, bottom); // back up the other side
  ctx.arcTo(x, bottom, x, y, radius); // bottom edge into bottom-left corner
  ctx.arcTo(x, y, right, y, radius); // left edge into top-left corner
  ctx.closePath();
}

/**
 * Picks a font size and line breaks that fit the bubble: one line if it can
 * stay comfortably large, otherwise two balanced lines, and only as a last
 * resort a single line squeezed smaller.
 */
function layoutText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, lang: Lang) {
  const width = (s: string, size: number) => {
    ctx.font = `800 ${size}px ${FONT}`;
    return ctx.measureText(s).width;
  };
  const top = lang === 'ar' ? 48 : 40;
  const singleMin = lang === 'ar' ? 34 : 30;

  for (let size = top; size >= singleMin; size -= 2) {
    if (width(text, size) <= maxW) return { lines: [text], size };
  }

  const words = text.split(' ');
  if (words.length > 1) {
    let best = [text],
      bestWidth = Infinity;
    for (let i = 1; i < words.length; i++) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const w = Math.max(width(pair[0], top), width(pair[1], top));
      if (w < bestWidth) {
        bestWidth = w;
        best = pair;
      }
    }
    for (let size = top - 4; size >= 22; size -= 2) {
      if (size * 1.25 * 2 <= maxH && best.every((line) => width(line, size) <= maxW)) return { lines: best, size };
    }
  }

  let size = singleMin - 2;
  while (size > 20 && width(text, size) > maxW) size -= 2;
  return { lines: [text], size };
}

export function drawSpeechBubble(canvas: HTMLCanvasElement, kind: BubbleKind, text: string, lang: Lang) {
  canvas.width = BUBBLE_W;
  canvas.height = BUBBLE_H;
  const ctx = canvas.getContext('2d')!;
  const isMiss = kind === 'missed';
  const { y, h } = BUBBLE;
  const bottom = y + h;
  ctx.direction = lang === 'ar' ? 'rtl' : 'ltr';
  ctx.lineJoin = 'round';

  // Body + pointer in one fill, with a soft drop shadow.
  ctx.save();
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 7;
  const grad = ctx.createLinearGradient(0, y, 0, bottom);
  if (isMiss) {
    grad.addColorStop(0, '#ff6f5c');
    grad.addColorStop(1, '#c0392b');
  } else {
    grad.addColorStop(0, '#ffe9ab');
    grad.addColorStop(1, '#e0a94a');
  }
  ctx.fillStyle = grad;
  traceBubble(ctx);
  ctx.fill();
  ctx.restore();

  // One unbroken outline around the whole shape.
  ctx.lineWidth = 7;
  ctx.strokeStyle = isMiss ? '#ffdccf' : '#fff3d6';
  traceBubble(ctx);
  ctx.stroke();

  // Text, centered in the rectangle part.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isMiss ? '#fff7f0' : '#3b2313';
  const { lines, size } = layoutText(ctx, text, BUBBLE.w - 72, h - 28, lang);
  ctx.font = `800 ${size}px ${FONT}`;
  const lineHeight = size * 1.2,
    firstY = y + h / 2 + 3 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, BUBBLE_W / 2, firstY + i * lineHeight));
}
