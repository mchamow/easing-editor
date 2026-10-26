import { beforeEach, describe, expect, it } from 'vitest'
import { initialState, type State } from './reducer'
import { load, save, STORAGE_KEY } from './storage'

const put = (v: unknown) => localStorage.setItem(STORAGE_KEY, typeof v === 'string' ? v : JSON.stringify(v))

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('round-trips the editor', () => {
    const s: State = {
      curve: [0.1, -0.5, 0.9, 1.5],
      duration: 650,
      property: 'rotate',
      compare: false,
      loop: true,
      saved: [{ id: 4, name: 'Snappy', curve: [0.2, 0, 0, 1] }],
      nextId: 5,
    }
    save(s)
    expect(load()).toEqual(s)
  })

  it('falls back to defaults when nothing or garbage is stored', () => {
    expect(load()).toEqual(initialState())
    put('{not json')
    expect(load()).toEqual(initialState())
    put([1, 2])
    expect(load()).toEqual(initialState())
  })

  it('replaces bad fields one by one', () => {
    put({ curve: [1.5, 0, 1, 1], duration: 'slow', property: 'wobble', compare: 1, loop: true, saved: 'none' })
    expect(load()).toEqual({ ...initialState(), loop: true })
    put({ curve: [0, 0, 1, 9] })
    expect(load().curve).toEqual(initialState().curve)
    put({ duration: 123456 })
    expect(load().duration).toBe(3000)
  })

  it('drops malformed or duplicate saved curves and keeps ids ahead of them', () => {
    put({
      saved: [
        { id: 7, name: 'Good', curve: [0, 0, 1, 1] },
        { id: 7, name: 'Duplicate', curve: [0, 0, 1, 1] },
        { id: 8, name: '  ', curve: [0, 0, 1, 1] },
        { id: 9, name: 'Bad curve', curve: [0, 0, 2, 1] },
        { id: 'x', name: 'Bad id', curve: [0, 0, 1, 1] },
        null,
      ],
      nextId: 3,
    })
    const s = load()
    expect(s.saved).toEqual([{ id: 7, name: 'Good', curve: [0, 0, 1, 1] }])
    expect(s.nextId).toBe(8)
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    } as unknown as Storage
    expect(() => save(initialState(), broken)).not.toThrow()
    expect(load(broken)).toEqual(initialState())
  })
})
