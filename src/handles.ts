import type { Handle } from './bezier'

export const HANDLE_STROKE = { pink: 'stroke-pink-500 dark:stroke-pink-400', sky: 'stroke-sky-500 dark:stroke-sky-400' }
export const HANDLE_FILL = { pink: 'fill-pink-500 dark:fill-pink-400', sky: 'fill-sky-500 dark:fill-sky-400' }

/** The two control points: P1 hangs off the start (0, 0), P2 off the end (1, 1). */
export const HANDLES: { handle: Handle; label: string; anchor: [number, number]; color: keyof typeof HANDLE_FILL }[] = [
  { handle: 0, label: 'Handle 1', anchor: [0, 0], color: 'pink' },
  { handle: 1, label: 'Handle 2', anchor: [1, 1], color: 'sky' },
]
