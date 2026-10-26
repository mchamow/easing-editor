import { type Curve, type Handle, KEYWORDS, reverse, withHandle } from './bezier'

export const PROPERTIES = ['move', 'scale', 'rotate', 'fade'] as const
export type Property = (typeof PROPERTIES)[number]
export const isProperty = (v: unknown): v is Property => PROPERTIES.includes(v as Property)

export const DURATION_MIN = 100
export const DURATION_MAX = 3000
export const DURATION_STEP = 50
export const MAX_SAVED = 30
export const NAME_MAX = 40

export interface Saved {
  id: number
  name: string
  curve: Curve
}

export interface State {
  curve: Curve
  /** Preview length in milliseconds. */
  duration: number
  property: Property
  /** Show a linear lane under the curve's lane. */
  compare: boolean
  loop: boolean
  saved: Saved[]
  nextId: number
}

export type Action =
  | { type: 'setCurve'; curve: Curve }
  | { type: 'moveHandle'; handle: Handle; x: number; y: number }
  | { type: 'nudge'; handle: Handle; dx: number; dy: number }
  | { type: 'reverse' }
  | { type: 'setDuration'; duration: number }
  | { type: 'setProperty'; property: Property }
  | { type: 'setCompare'; compare: boolean }
  | { type: 'setLoop'; loop: boolean }
  | { type: 'save'; name: string }
  | { type: 'remove'; id: number }

export const initialState = (): State => ({
  curve: KEYWORDS.ease,
  duration: 1000,
  property: 'move',
  compare: true,
  loop: false,
  saved: [],
  nextId: 1,
})

export const clampDuration = (ms: number) =>
  Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(ms / DURATION_STEP) * DURATION_STEP))

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setCurve':
      return { ...state, curve: action.curve }
    case 'moveHandle':
      return { ...state, curve: withHandle(state.curve, action.handle, action.x, action.y) }
    case 'nudge': {
      const i = action.handle * 2
      return {
        ...state,
        curve: withHandle(state.curve, action.handle, state.curve[i] + action.dx, state.curve[i + 1] + action.dy),
      }
    }
    case 'reverse':
      return { ...state, curve: reverse(state.curve) }
    case 'setDuration':
      return { ...state, duration: clampDuration(action.duration) }
    case 'setProperty':
      return { ...state, property: action.property }
    case 'setCompare':
      return { ...state, compare: action.compare }
    case 'setLoop':
      return { ...state, loop: action.loop }
    case 'save': {
      if (state.saved.length >= MAX_SAVED) return state
      const name = action.name.trim().slice(0, NAME_MAX) || `Curve ${state.nextId}`
      return {
        ...state,
        saved: [...state.saved, { id: state.nextId, name, curve: state.curve }],
        nextId: state.nextId + 1,
      }
    }
    case 'remove':
      return { ...state, saved: state.saved.filter((s) => s.id !== action.id) }
  }
}
