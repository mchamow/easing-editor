import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { type Curve, curvePath, formatNumber, type Handle, Y_MAX, Y_MIN } from './bezier'
import { HANDLE_FILL, HANDLE_STROKE, HANDLES } from './handles'

// Graph geometry in viewBox units: the time axis gets twice the scale of the progress axis, so the
// overshoot room above and below the unit square doesn't make the graph tower over everything else.
const XU = 300
const YU = 150
const PAD_X = 28
const PAD_Y = 14
const VB_W = XU + 2 * PAD_X
const VB_H = (Y_MAX - Y_MIN) * YU + 2 * PAD_Y
const sx = (x: number) => PAD_X + x * XU
const sy = (y: number) => PAD_Y + (Y_MAX - y) * YU

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

interface Props {
  curve: Curve
  onMove: (handle: Handle, x: number, y: number) => void
  onNudge: (handle: Handle, dx: number, dy: number) => void
  /** The playing preview's time fraction and eased progress, drawn as a dot riding the curve. */
  progress: { t: number; p: number } | null
  handleRefs: React.RefObject<(SVGGElement | null)[]>
}

export function CurveEditor({ curve, onMove, onNudge, progress, handleRefs }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  /** The handle being dragged and how far the grab point sat from its centre. */
  const drag = useRef<{ handle: Handle; dx: number; dy: number; pointer: number } | null>(null)

  const toGraph = (e: PointerEvent): [number, number] => {
    const rect = svg.current!.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * VB_W
    const vy = ((e.clientY - rect.top) / rect.height) * VB_H
    return [(vx - PAD_X) / XU, Y_MAX - (vy - PAD_Y) / YU]
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const [x, y] = toGraph(e)
    const hit = (e.target as Element).closest('[data-handle]')?.getAttribute('data-handle')
    let handle: Handle
    let dx = 0
    let dy = 0
    if (hit != null) {
      // Grabbed a handle: keep the offset so it doesn't jump under the pointer.
      handle = Number(hit) as Handle
      dx = curve[handle * 2] - x
      dy = curve[handle * 2 + 1] - y
    } else {
      // Pressed on the graph: the nearer handle (in screen distance) jumps there.
      const dist = (h: Handle) => Math.hypot((curve[h * 2] - x) * XU, (curve[h * 2 + 1] - y) * YU)
      handle = dist(0) <= dist(1) ? 0 : 1
      onMove(handle, x, y)
    }
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { handle, dx, dy, pointer: e.pointerId }
    handleRefs.current[handle]?.focus({ preventScroll: true })
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const [x, y] = toGraph(e)
    onMove(d.handle, x + d.dx, y + d.dy)
  }

  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null
  }

  const onKeyDown = (handle: Handle) => (e: KeyboardEvent) => {
    const dir = ARROWS[e.key]
    if (!dir || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    const step = e.shiftKey ? 0.1 : 0.01
    onNudge(handle, dir[0] * step, dir[1] * step)
  }

  const gridX = [0.25, 0.5, 0.75]
  const gridY = [-0.5, -0.25, 0.25, 0.5, 0.75, 1.25, 1.5]

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block w-full touch-none select-none"
      role="group"
      aria-label="Curve graph"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect x={sx(0)} y={sy(Y_MAX)} width={XU} height={(Y_MAX - Y_MIN) * YU} className="fill-muted/40" rx={6} />
      <rect x={sx(0)} y={sy(1)} width={XU} height={YU} className="fill-muted stroke-border" strokeWidth={1} />
      {gridX.map((x) => (
        <line key={x} x1={sx(x)} x2={sx(x)} y1={sy(Y_MAX)} y2={sy(Y_MIN)} className="stroke-border" strokeWidth={1} />
      ))}
      {gridY.map((y) => (
        <line key={y} x1={sx(0)} x2={sx(1)} y1={sy(y)} y2={sy(y)} className="stroke-border/70" strokeWidth={1} />
      ))}
      <line
        x1={sx(0)}
        y1={sy(0)}
        x2={sx(1)}
        y2={sy(1)}
        className="stroke-muted-foreground/40"
        strokeWidth={1.5}
        strokeDasharray="5 5"
      />
      <g className="fill-muted-foreground text-[13px]" aria-hidden>
        <text x={sx(0) - 8} y={sy(0) + 4} textAnchor="end">
          0
        </text>
        <text x={sx(0) - 8} y={sy(1) + 4} textAnchor="end">
          1
        </text>
        <text x={sx(1)} y={sy(0) + 16} textAnchor="end">
          time →
        </text>
        <text x={sx(0) + 6} y={sy(1) - 8}>
          ↑ progress
        </text>
      </g>

      {progress && (
        <g aria-hidden className="pointer-events-none">
          <line
            x1={sx(progress.t)}
            x2={sx(progress.t)}
            y1={sy(0)}
            y2={sy(progress.p)}
            className="stroke-violet-500/40"
            strokeWidth={1}
          />
          <line
            x1={sx(0)}
            x2={sx(progress.t)}
            y1={sy(progress.p)}
            y2={sy(progress.p)}
            className="stroke-violet-500/40"
            strokeWidth={1}
          />
          <circle cx={sx(progress.t)} cy={sy(progress.p)} r={6} className="fill-violet-500" />
        </g>
      )}

      {HANDLES.map(({ handle, anchor, color }) => (
        <line
          key={handle}
          x1={sx(anchor[0])}
          y1={sy(anchor[1])}
          x2={sx(curve[handle * 2])}
          y2={sy(curve[handle * 2 + 1])}
          className={HANDLE_STROKE[color]}
          strokeWidth={2}
        />
      ))}
      <path
        d={curvePath(curve, sx, sy)}
        className="fill-none stroke-violet-600 dark:stroke-violet-400"
        strokeWidth={3.5}
        strokeLinecap="round"
        data-testid="curve"
      />
      <circle cx={sx(0)} cy={sy(0)} r={4} className="fill-foreground" />
      <circle cx={sx(1)} cy={sy(1)} r={4} className="fill-foreground" />

      {HANDLES.map(({ handle, label, color }) => {
        const x = curve[handle * 2]
        const y = curve[handle * 2 + 1]
        return (
          <g
            key={handle}
            ref={(el) => {
              handleRefs.current[handle] = el
            }}
            data-handle={handle}
            tabIndex={0}
            role="button"
            aria-roledescription="draggable handle"
            aria-label={`${label}: x ${formatNumber(x)}, y ${formatNumber(y)}`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            onKeyDown={onKeyDown(handle)}
            className="group cursor-grab outline-none active:cursor-grabbing"
          >
            <circle cx={sx(x)} cy={sy(y)} r={22} className="fill-transparent" />
            <circle
              cx={sx(x)}
              cy={sy(y)}
              r={14}
              className={`${HANDLE_FILL[color]} opacity-0 transition-opacity group-hover:opacity-20 group-focus-visible:opacity-30`}
            />
            <circle
              cx={sx(x)}
              cy={sy(y)}
              r={8}
              className={`${HANDLE_FILL[color]} stroke-background`}
              strokeWidth={2.5}
            />
          </g>
        )
      })}
    </svg>
  )
}

/** A small, non-interactive picture of a curve for preset and saved-curve buttons. */
export function CurveThumb({ curve, className }: { curve: Curve; className?: string }) {
  const S = 32
  // The drawn curve overshoots far less than its control points, so a tight range keeps it readable.
  const lo = -0.25
  const hi = 1.25
  const tx = (x: number) => 4 + x * S
  const ty = (y: number) => 4 + ((hi - y) / (hi - lo)) * S
  return (
    <svg viewBox={`0 0 ${S + 8} ${S + 8}`} className={className} overflow="visible" aria-hidden>
      <rect x={tx(0)} y={ty(1)} width={S} height={ty(0) - ty(1)} className="fill-muted-foreground/10" rx={1} />
      <path d={curvePath(curve, tx, ty)} className="fill-none stroke-current" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}
