/** The four numbers of a CSS `cubic-bezier(x1, y1, x2, y2)`: the two control points P1 and P2. */
export type Curve = readonly [x1: number, y1: number, x2: number, y2: number]
export type Handle = 0 | 1

/** How far the handles may overshoot: enough room for the "back" curves, which go to -0.6 and 1.6. */
export const Y_MIN = -0.75
export const Y_MAX = 1.75

export const LINEAR: Curve = [0, 0, 1, 1]

/** Handle x values are time fractions; CSS rejects a cubic-bezier with x outside [0, 1]. */
export const isTime = (x: number) => x >= 0 && x <= 1

/** One coordinate of the curve at parameter s, with the end points fixed at 0 and 1. */
const bez = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s ** 2 + s ** 3
const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s ** 2

/**
 * The eased progress at time fraction `x`, the way a browser evaluates the timing function: find the
 * parameter where the curve's x is `x` (Newton's method, then bisection if that stalls), read its y.
 */
export function ease([x1, y1, x2, y2]: Curve, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let s = x
  for (let i = 0; i < 8; i++) {
    const err = bez(x1, x2, s) - x
    if (Math.abs(err) < 1e-7) return bez(y1, y2, s)
    const d = slope(x1, x2, s)
    if (Math.abs(d) < 1e-6) break
    s -= err / d
    if (s < 0 || s > 1) break
  }
  // x1, x2 in [0, 1] make the curve's x rise steadily, so bisection always finds it.
  let lo = 0
  let hi = 1
  s = x
  for (let i = 0; i < 60; i++) {
    const v = bez(x1, x2, s)
    if (Math.abs(v - x) < 1e-7) break
    if (v < x) lo = s
    else hi = s
    s = (lo + hi) / 2
  }
  return bez(y1, y2, s)
}

/** Rounds to `places` decimals, without ever producing -0. */
export function round(n: number, places = 2): number {
  const f = 10 ** places
  return Math.round(n * f) / f || 0
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** A handle position kept on the graph: x within the time axis, y within the overshoot room, to 0.01. */
export function clampPoint(x: number, y: number): [number, number] {
  return [round(clamp(x, 0, 1)), round(clamp(y, Y_MIN, Y_MAX))]
}

/** The curve with one handle moved to (x, y), clamped onto the graph. */
export function withHandle(curve: Curve, handle: Handle, x: number, y: number): Curve {
  const [cx, cy] = clampPoint(x, y)
  return handle === 0 ? [cx, cy, curve[2], curve[3]] : [curve[0], curve[1], cx, cy]
}

/** The same motion played backwards: an ease-in becomes an ease-out. */
export function reverse([x1, y1, x2, y2]: Curve): Curve {
  return [round(1 - x2, 3), round(1 - y2, 3), round(1 - x1, 3), round(1 - y1, 3)]
}

export const sameCurve = (a: Curve, b: Curve) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9)

/** A number as CSS would want it written: up to three decimals, no trailing zeros. */
export const formatNumber = (n: number) => String(round(n, 3))

export const formatCurve = (curve: Curve) => `cubic-bezier(${curve.map(formatNumber).join(', ')})`

/** The CSS timing-function keywords that are cubic Béziers. */
export const KEYWORDS: Record<string, Curve> = {
  linear: LINEAR,
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

export const keywordFor = (curve: Curve) => Object.keys(KEYWORDS).find((k) => sameCurve(KEYWORDS[k], curve))

export type Parsed = { ok: true; curve: Curve } | { ok: false; error: string }

/**
 * Reads what someone typed or pasted: a keyword (`ease-in`), `cubic-bezier(a, b, c, d)` or just the
 * four numbers, optionally with a trailing semicolon.
 */
export function parseCurve(text: string): Parsed {
  const t = text.trim().toLowerCase().replace(/;$/, '').trim()
  if (t in KEYWORDS) return { ok: true, curve: KEYWORDS[t] }
  const inner = t.match(/^cubic-bezier\s*\((.*)\)$/)?.[1] ?? t
  const parts = inner.split(/[\s,]+/).filter(Boolean)
  const nums = parts.map(Number)
  if (parts.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Enter four numbers, cubic-bezier(…) or a keyword like ease-in.' }
  }
  const [x1, y1, x2, y2] = nums.map((n) => round(n, 3))
  if (!isTime(x1) || !isTime(x2)) return { ok: false, error: 'The x values must be between 0 and 1.' }
  if ([y1, y2].some((y) => y < Y_MIN || y > Y_MAX)) {
    return { ok: false, error: `The y values must be between ${Y_MIN} and ${Y_MAX}.` }
  }
  return { ok: true, curve: [x1, y1, x2, y2] }
}

/**
 * An SVG path for the curve. A timing function is itself a cubic Bézier from (0, 0) to (1, 1), and
 * the mapping to the screen is affine, so the control points map straight across.
 */
export function curvePath([x1, y1, x2, y2]: Curve, sx: (x: number) => number, sy: (y: number) => number): string {
  const p = (x: number, y: number) => `${round(sx(x), 2)} ${round(sy(y), 2)}`
  return `M ${p(0, 0)} C ${p(x1, y1)}, ${p(x2, y2)}, ${p(1, 1)}`
}
