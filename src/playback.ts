import { useCallback, useEffect, useState } from 'react'

/** How long a looping preview rests at the end before it starts over. */
export const LOOP_PAUSE = 600

/**
 * Where the preview is `elapsed` ms after it started: the time fraction `t` (held at 1 during the
 * pause between loops) and, for a single run, whether it has finished.
 */
export function frame(elapsed: number, duration: number, loop: boolean): { t: number; done: boolean } {
  if (!loop) return { t: Math.min(1, Math.max(0, elapsed / duration)), done: elapsed >= duration }
  const e = elapsed % (duration + LOOP_PAUSE)
  return { t: Math.min(1, e / duration), done: false }
}

/** Plays a time fraction from 0 to 1 over `duration` ms, frame by frame, optionally on repeat. */
export function usePlayback(duration: number, loop: boolean) {
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!playing) return
    let id = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const f = frame(now - start, duration, loop)
      setT(f.t)
      if (f.done) setPlaying(false)
      else id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing, run, duration, loop])

  const play = useCallback(() => {
    setT(0)
    setRun((r) => r + 1)
    setPlaying(true)
  }, [])
  const stop = useCallback(() => {
    setPlaying(false)
    setT(0)
  }, [])
  const toggle = useCallback(() => (playing ? stop() : play()), [playing, play, stop])

  return { playing, t, play, stop, toggle }
}
