import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { Property } from './reducer'

const BOX = '2.5rem'
const CENTRE = `calc(50% - ${BOX} / 2)`

/** Where the box is drawn at progress `v` (which may overshoot below 0 or past 1). */
function boxStyle(property: Property, v: number): CSSProperties {
  switch (property) {
    case 'move':
      // Travel between 8% and 92% of the lane, leaving room for curves that overshoot either end.
      return { left: `calc(8% + (84% - ${BOX}) * ${v})` }
    case 'scale':
      return { left: CENTRE, transform: `scale(${0.2 + 0.8 * v})` }
    case 'rotate':
      return { left: CENTRE, transform: `rotate(${180 * v}deg)` }
    case 'fade':
      return { left: CENTRE, opacity: Math.min(1, Math.max(0, v)) }
  }
}

function Lane({ label, property, value, ghost }: { label: string; property: Property; value: number; ghost?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className="relative h-16 overflow-hidden rounded-lg bg-muted/60 ring-1 ring-border ring-inset"
        data-testid={`lane-${ghost ? 'linear' : 'curve'}`}
      >
        {property !== 'move' && (
          <div className="absolute top-3 size-10 rounded-md border-2 border-dashed border-border" style={{ left: CENTRE }} />
        )}
        <div
          className={cn(
            'absolute top-3 size-10 rounded-md shadow-sm',
            ghost ? 'bg-muted-foreground/45' : 'bg-gradient-to-br from-violet-500 to-pink-500',
          )}
          style={boxStyle(property, value)}
        />
      </div>
    </div>
  )
}

interface Props {
  property: Property
  compare: boolean
  /** Time fraction. */
  t: number
  /** Eased progress at that time. */
  p: number
}

export function Preview({ property, compare, t, p }: Props) {
  return (
    <div className="flex flex-col gap-3 px-1">
      <Lane label="Your curve" property={property} value={p} />
      {compare && <Lane label="Linear" property={property} value={t} ghost />}
    </div>
  )
}
