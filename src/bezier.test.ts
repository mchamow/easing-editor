import { describe, expect, it } from 'vitest'
import {
  clampPoint,
  curvePath,
  ease,
  formatCurve,
  keywordFor,
  KEYWORDS,
  LINEAR,
  parseCurve,
  reverse,
  round,
  sameCurve,
  withHandle,
} from './bezier'

describe('ease', () => {
  it('pins the ends at 0 and 1', () => {
    for (const c of Object.values(KEYWORDS)) {
      expect(ease(c, 0)).toBe(0)
      expect(ease(c, 1)).toBe(1)
      expect(ease(c, -0.5)).toBe(0)
      expect(ease(c, 2)).toBe(1)
    }
  })

  it('is the identity for linear', () => {
    for (const x of [0.1, 0.33, 0.5, 0.9]) expect(ease(LINEAR, x)).toBeCloseTo(x, 6)
  })

  it('matches known values of the CSS keywords', () => {
    expect(ease(KEYWORDS.ease, 0.5)).toBeCloseTo(0.8024, 3)
    expect(ease(KEYWORDS['ease-in'], 0.5)).toBeCloseTo(0.3153, 3)
    expect(ease(KEYWORDS['ease-out'], 0.5)).toBeCloseTo(0.6847, 3)
    expect(ease(KEYWORDS['ease-in-out'], 0.5)).toBeCloseTo(0.5, 6)
  })

  it('overshoots for back curves and stays monotonic in time', () => {
    const backOut = [0.34, 1.56, 0.64, 1] as const
    const max = Math.max(...Array.from({ length: 99 }, (_, i) => ease(backOut, (i + 1) / 100)))
    expect(max).toBeGreaterThan(1.05)
    const backIn = [0.36, 0, 0.66, -0.56] as const
    expect(Math.min(...Array.from({ length: 99 }, (_, i) => ease(backIn, (i + 1) / 100)))).toBeLessThan(-0.05)
  })

  it('copes with flat stretches where Newton stalls', () => {
    // x1 = x2 = 1 makes the x-slope vanish near the start; bisection still lands it.
    const c = [1, 0, 1, 1] as const
    const y = ease(c, 0.5)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(1)
    expect(ease([0, 1, 0, 1], 0.001)).toBeGreaterThan(0)
  })
})

describe('handles', () => {
  it('clamps x to the time axis and y to the overshoot room, to 0.01', () => {
    expect(clampPoint(-0.2, 3)).toEqual([0, 1.75])
    expect(clampPoint(1.4, -2)).toEqual([1, -0.75])
    expect(clampPoint(0.123, 0.456)).toEqual([0.12, 0.46])
  })

  it('moves one handle and leaves the other', () => {
    expect(withHandle(KEYWORDS.ease, 0, 0.5, 0.5)).toEqual([0.5, 0.5, 0.25, 1])
    expect(withHandle(KEYWORDS.ease, 1, 2, 0.333)).toEqual([0.25, 0.1, 1, 0.33])
  })

  it('reverses ease-in into ease-out and back', () => {
    expect(reverse(KEYWORDS['ease-in'])).toEqual(KEYWORDS['ease-out'])
    expect(reverse(reverse(KEYWORDS.ease))).toEqual(KEYWORDS.ease)
  })

  it('never rounds to -0', () => {
    expect(Object.is(round(-0.001), 0)).toBe(true)
  })
})

describe('formatting and parsing', () => {
  it('formats as CSS', () => {
    expect(formatCurve(KEYWORDS.ease)).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
    expect(formatCurve([0.68, -0.6, 0.32, 1.6])).toBe('cubic-bezier(0.68, -0.6, 0.32, 1.6)')
  })

  it('names keyword curves', () => {
    expect(keywordFor([0.42, 0, 1, 1])).toBe('ease-in')
    expect(keywordFor([0.4, 0, 1, 1])).toBeUndefined()
  })

  it('reads keywords, cubic-bezier() and bare numbers', () => {
    expect(parseCurve('  Ease-In-Out; ')).toEqual({ ok: true, curve: KEYWORDS['ease-in-out'] })
    expect(parseCurve('cubic-bezier(0.1, 0.7, 1.0, 0.1)')).toEqual({ ok: true, curve: [0.1, 0.7, 1, 0.1] })
    expect(parseCurve('cubic-bezier( .5 , -.5 , .5 , 1.5 );')).toEqual({ ok: true, curve: [0.5, -0.5, 0.5, 1.5] })
    expect(parseCurve('0.2 0.4 0.6 0.8')).toEqual({ ok: true, curve: [0.2, 0.4, 0.6, 0.8] })
    expect(parseCurve('0.12345, 0, 1, 1')).toEqual({ ok: true, curve: [0.123, 0, 1, 1] })
  })

  it('explains what is wrong with bad input', () => {
    expect(parseCurve('bouncy')).toMatchObject({ ok: false, error: expect.stringMatching(/four numbers/) })
    expect(parseCurve('1, 2, 3')).toMatchObject({ ok: false })
    expect(parseCurve('0, 0, 1, x')).toMatchObject({ ok: false })
    expect(parseCurve('1.2, 0, 1, 1')).toMatchObject({ ok: false, error: expect.stringMatching(/x values/) })
    expect(parseCurve('0.5, 3, 0.5, 1')).toMatchObject({ ok: false, error: expect.stringMatching(/y values/) })
  })

  it('compares curves by value', () => {
    expect(sameCurve([0.25, 0.1, 0.25, 1], KEYWORDS.ease)).toBe(true)
    expect(sameCurve([0.25, 0.1, 0.25, 0.99], KEYWORDS.ease)).toBe(false)
  })

  it('draws the curve as one cubic segment through the mapped control points', () => {
    expect(curvePath(KEYWORDS.ease, (x) => x * 100, (y) => 100 - y * 100)).toBe('M 0 100 C 25 90, 25 0, 100 0')
  })
})
