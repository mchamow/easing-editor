import { describe, expect, it } from 'vitest'
import { KEYWORDS } from './bezier'
import { ALL_PRESETS, FAMILIES } from './presets'
import { initialState, MAX_SAVED, reducer, type State } from './reducer'

const start = (extra: Partial<State> = {}): State => ({ ...initialState(), ...extra })

describe('reducer', () => {
  it('starts on ease, 1s, moving, compared with linear', () => {
    expect(initialState()).toMatchObject({ curve: KEYWORDS.ease, duration: 1000, property: 'move', compare: true, loop: false })
  })

  it('moves and nudges handles within the graph', () => {
    let s = reducer(start(), { type: 'moveHandle', handle: 1, x: 0.7, y: 1.9 })
    expect(s.curve).toEqual([0.25, 0.1, 0.7, 1.75])
    s = reducer(s, { type: 'nudge', handle: 0, dx: 0.01, dy: -0.1 })
    expect(s.curve).toEqual([0.26, 0, 0.7, 1.75])
    s = reducer(s, { type: 'nudge', handle: 0, dx: -1, dy: 0 })
    expect(s.curve[0]).toBe(0)
  })

  it('reverses the curve', () => {
    expect(reducer(start({ curve: KEYWORDS['ease-out'] }), { type: 'reverse' }).curve).toEqual(KEYWORDS['ease-in'])
  })

  it('keeps the duration in range and on the 50 ms grid', () => {
    expect(reducer(start(), { type: 'setDuration', duration: 1234 }).duration).toBe(1250)
    expect(reducer(start(), { type: 'setDuration', duration: 10 }).duration).toBe(100)
    expect(reducer(start(), { type: 'setDuration', duration: 99999 }).duration).toBe(3000)
  })

  it('saves named curves, numbering unnamed ones', () => {
    let s = reducer(start(), { type: 'save', name: '  Bouncy  ' })
    s = reducer({ ...s, curve: KEYWORDS.linear }, { type: 'save', name: '' })
    expect(s.saved).toEqual([
      { id: 1, name: 'Bouncy', curve: KEYWORDS.ease },
      { id: 2, name: 'Curve 2', curve: KEYWORDS.linear },
    ])
    s = reducer(s, { type: 'remove', id: 1 })
    expect(s.saved.map((c) => c.name)).toEqual(['Curve 2'])
    expect(reducer(s, { type: 'save', name: 'x' }).saved.at(-1)?.id).toBe(3)
  })

  it('stops saving at the limit', () => {
    let s = start()
    for (let i = 0; i < MAX_SAVED + 3; i++) s = reducer(s, { type: 'save', name: `c${i}` })
    expect(s.saved).toHaveLength(MAX_SAVED)
  })

  it('switches property, compare and loop', () => {
    let s = reducer(start(), { type: 'setProperty', property: 'fade' })
    s = reducer(s, { type: 'setCompare', compare: false })
    s = reducer(s, { type: 'setLoop', loop: true })
    expect(s).toMatchObject({ property: 'fade', compare: false, loop: true })
  })
})

describe('presets', () => {
  it('has the five CSS keywords and in/out/in-out for every family, all distinct names', () => {
    expect(ALL_PRESETS).toHaveLength(5 + FAMILIES.length * 3)
    expect(new Set(ALL_PRESETS.map((p) => p.name)).size).toBe(ALL_PRESETS.length)
  })

  it('keeps every preset inside the graph', () => {
    for (const { curve } of ALL_PRESETS) {
      expect(curve[0]).toBeGreaterThanOrEqual(0)
      expect(curve[2]).toBeLessThanOrEqual(1)
      expect(Math.min(curve[1], curve[3])).toBeGreaterThanOrEqual(-0.75)
      expect(Math.max(curve[1], curve[3])).toBeLessThanOrEqual(1.75)
    }
  })
})
