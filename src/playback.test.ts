import { describe, expect, it } from 'vitest'
import { frame, LOOP_PAUSE } from './playback'

describe('frame', () => {
  it('runs once from 0 to 1 and then stops', () => {
    expect(frame(0, 1000, false)).toEqual({ t: 0, done: false })
    expect(frame(250, 1000, false)).toEqual({ t: 0.25, done: false })
    expect(frame(1000, 1000, false)).toEqual({ t: 1, done: true })
    expect(frame(1500, 1000, false)).toEqual({ t: 1, done: true })
  })

  it('loops with a rest at the end', () => {
    expect(frame(500, 1000, true)).toEqual({ t: 0.5, done: false })
    expect(frame(1000 + LOOP_PAUSE / 2, 1000, true)).toEqual({ t: 1, done: false })
    expect(frame(1000 + LOOP_PAUSE + 250, 1000, true).t).toBeCloseTo(0.25)
  })
})
