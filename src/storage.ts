import { type Curve, isTime, Y_MAX, Y_MIN } from './bezier'
import { clampDuration, initialState, isProperty, MAX_SAVED, NAME_MAX, type Saved, type State } from './reducer'

export const STORAGE_KEY = 'easing-editor'

export function save(state: State, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked: the editor still works, it just won't remember.
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function readCurve(v: unknown): Curve | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) return null
  const [x1, y1, x2, y2] = v as number[]
  if (!isTime(x1) || !isTime(x2) || [y1, y2].some((y) => y < Y_MIN || y > Y_MAX)) return null
  return [x1, y1, x2, y2]
}

function readSaved(v: unknown): Saved[] {
  if (!Array.isArray(v)) return []
  const ids = new Set<number>()
  const out: Saved[] = []
  for (const s of v) {
    if (!isRecord(s) || !Number.isSafeInteger(s.id) || ids.has(s.id as number)) continue
    const curve = readCurve(s.curve)
    if (!curve || typeof s.name !== 'string' || !s.name.trim()) continue
    ids.add(s.id as number)
    out.push({ id: s.id as number, name: s.name.slice(0, NAME_MAX), curve })
  }
  return out.slice(0, MAX_SAVED)
}

/** The saved editor, field by field: anything missing or malformed falls back to its default. */
export function load(storage: Storage = localStorage): State {
  const fresh = initialState()
  let raw: unknown
  try {
    raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    raw = null
  }
  if (!isRecord(raw)) return fresh
  const saved = readSaved(raw.saved)
  const maxId = Math.max(0, ...saved.map((s) => s.id))
  return {
    curve: readCurve(raw.curve) ?? fresh.curve,
    duration: isNum(raw.duration) ? clampDuration(raw.duration) : fresh.duration,
    property: isProperty(raw.property) ? raw.property : fresh.property,
    compare: typeof raw.compare === 'boolean' ? raw.compare : fresh.compare,
    loop: typeof raw.loop === 'boolean' ? raw.loop : fresh.loop,
    saved,
    nextId: Number.isSafeInteger(raw.nextId) && (raw.nextId as number) > maxId ? (raw.nextId as number) : maxId + 1,
  }
}
