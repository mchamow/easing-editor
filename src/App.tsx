import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ArrowLeftRightIcon, BookmarkPlusIcon, CheckIcon, CopyIcon, PlayIcon, SquareIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { type Curve, ease, formatCurve, formatNumber, type Handle, keywordFor, parseCurve, sameCurve } from './bezier'
import { CurveEditor, CurveThumb } from './CurveEditor'
import { HANDLE_FILL, HANDLES } from './handles'
import { usePlayback } from './playback'
import { CSS_PRESETS, FAMILIES, VARIANTS } from './presets'
import { Preview } from './Preview'
import {
  DURATION_MAX,
  DURATION_MIN,
  DURATION_STEP,
  isProperty,
  MAX_SAVED,
  NAME_MAX,
  PROPERTIES,
  reducer,
  type Property,
} from './reducer'
import { load, save } from './storage'

const PROPERTY_LABELS: Record<Property, string> = { move: 'Move', scale: 'Scale', rotate: 'Rotate', fade: 'Fade' }
const CSS_PROPERTY: Record<Property, string> = { move: 'transform', scale: 'transform', rotate: 'transform', fade: 'opacity' }

const formatDuration = (ms: number) => (ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`)

/** Text fields swallow the single-key shortcuts; sliders, switches and buttons don't. */
const isTyping = (target: EventTarget | null) =>
  (target as Element | null)?.closest?.('textarea, [contenteditable="true"], input:not([type=range]):not([type=checkbox])') !=
  null
/** Space already means "press" on these, so it only plays from elsewhere. */
const takesSpace = (target: EventTarget | null) =>
  (target as Element | null)?.closest?.('button, a, input, [role=button], [role=switch], [role=slider], [role=radio]') != null

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load())
  const playback = usePlayback(state.duration, state.loop)
  const handleRefs = useRef<(SVGGElement | null)[]>([null, null])
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => save(state), [state])

  const css = formatCurve(state.curve)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(css)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }, [css])
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const pick = useCallback(
    (curve: Curve) => {
      dispatch({ type: 'setCurve', curve })
      playback.play()
    },
    [playback],
  )

  const { toggle } = playback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if ((key === ' ' && !takesSpace(e.target)) || key === 'p') {
        e.preventDefault()
        toggle()
      } else if (key === 'c') {
        void copy()
      } else if (key === 'r') {
        dispatch({ type: 'reverse' })
      } else if (key === '1' || key === '2') {
        handleRefs.current[Number(key) - 1]?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copy, toggle])

  const t = playback.t
  const p = ease(state.curve, t)
  const keyword = keywordFor(state.curve)

  return (
    <TooltipProvider>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:py-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-pink-400">
              Easing
            </span>{' '}
            Curve Editor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shape a <code className="font-mono">cubic-bezier()</code> by dragging its handles, watch it move, copy the CSS.
          </p>
        </header>

        {/* Two columns on wide screens; on phones the columns dissolve and `order` puts the preview first. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
            <Card className="max-lg:order-1">
              <CardHeader>
                <CardTitle>Curve</CardTitle>
                <CardDescription>Drag a handle or click the graph. Arrow keys nudge, Shift for bigger steps.</CardDescription>
                <CardAction>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="outline" size="sm" onClick={() => dispatch({ type: 'reverse' })} />}>
                      <ArrowLeftRightIcon />
                      Reverse
                    </TooltipTrigger>
                    <TooltipContent>
                      Play it backwards: ease-in ↔ ease-out <Kbd>R</Kbd>
                    </TooltipContent>
                  </Tooltip>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <CurveEditor
                  curve={state.curve}
                  handleRefs={handleRefs}
                  progress={playback.playing || t > 0 ? { t, p } : null}
                  onMove={(handle: Handle, x, y) => dispatch({ type: 'moveHandle', handle, x, y })}
                  onNudge={(handle: Handle, dx, dy) => dispatch({ type: 'nudge', handle, dx, dy })}
                />
                <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm tabular-nums" aria-hidden>
                  {HANDLES.map(({ handle, color }) => (
                    <span key={handle} className="flex items-center gap-2">
                      <svg viewBox="0 0 10 10" className="size-2.5">
                        <circle cx={5} cy={5} r={5} className={HANDLE_FILL[color]} />
                      </svg>
                      P{handle + 1} ({formatNumber(state.curve[handle * 2])}, {formatNumber(state.curve[handle * 2 + 1])})
                    </span>
                  ))}
                </div>
                <CssField curve={state.curve} onCommit={(curve) => dispatch({ type: 'setCurve', curve })}>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="outline" size="sm" onClick={() => void copy()} />}
                    >
                      {copied === 'ok' ? <CheckIcon className="text-emerald-600 dark:text-emerald-400" /> : <CopyIcon />}
                      Copy CSS
                    </TooltipTrigger>
                    <TooltipContent>
                      Copy <Kbd>C</Kbd>
                    </TooltipContent>
                  </Tooltip>
                </CssField>
                <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono break-all">
                    transition: {CSS_PROPERTY[state.property]} {formatDuration(state.duration)} {keyword ?? css};
                  </code>
                  {keyword && <Badge variant="secondary">same as {keyword}</Badge>}
                  <span role="status" className={cn(copied === 'fail' && 'text-destructive')}>
                    {copied === 'ok' ? 'Copied to clipboard' : copied === 'fail' ? 'Copy failed: select the text instead' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>

            <SavedCurves
              className="max-lg:order-4"
              saved={state.saved}
              current={state.curve}
              onSave={(name) => dispatch({ type: 'save', name })}
              onPick={pick}
              onRemove={(id) => dispatch({ type: 'remove', id })}
            />
          </div>

          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
            <Card className="max-lg:order-2">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  {formatDuration(state.duration)} · time {t.toFixed(2)} → progress {p.toFixed(2)}
                </CardDescription>
                <CardAction>
                  <Tooltip>
                    <TooltipTrigger render={<Button size="sm" onClick={playback.toggle} />}>
                      {playback.playing ? <SquareIcon /> : <PlayIcon />}
                      {playback.playing ? 'Stop' : 'Play'}
                    </TooltipTrigger>
                    <TooltipContent>
                      <Kbd>Space</Kbd> or <Kbd>P</Kbd>
                    </TooltipContent>
                  </Tooltip>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Preview property={state.property} compare={state.compare} t={t} p={p} />
                <ToggleGroup
                  aria-label="Animated property"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  className="w-full"
                  value={[state.property]}
                  onValueChange={(value) => {
                    if (isProperty(value[0])) dispatch({ type: 'setProperty', property: value[0] })
                  }}
                >
                  {PROPERTIES.map((prop) => (
                    <ToggleGroupItem key={prop} value={prop} className="flex-1">
                      {PROPERTY_LABELS[prop]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label id="duration-label">Duration</Label>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">{state.duration} ms</span>
                  </div>
                  <Slider
                    min={DURATION_MIN}
                    max={DURATION_MAX}
                    step={DURATION_STEP}
                    largeStep={500}
                    value={[state.duration]}
                    onValueChange={(v) => dispatch({ type: 'setDuration', duration: Array.isArray(v) ? v[0] : v })}
                    thumbLabel="Duration"
                    valueText={`${state.duration} milliseconds`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={state.compare}
                      onCheckedChange={(compare) => dispatch({ type: 'setCompare', compare })}
                    />
                    Compare with linear
                  </Label>
                  <Label className="flex items-center gap-2">
                    <Switch checked={state.loop} onCheckedChange={(loop) => dispatch({ type: 'setLoop', loop })} />
                    Loop
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Presets className="max-lg:order-3" current={state.curve} onPick={pick} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            <Kbd>Space</Kbd> play
          </span>
          <span>
            <Kbd>1</Kbd> <Kbd>2</Kbd> pick a handle, <Kbd>←</Kbd>
            <Kbd>↑</Kbd>
            <Kbd>→</Kbd>
            <Kbd>↓</Kbd> nudge
          </span>
          <span>
            <Kbd>R</Kbd> reverse
          </span>
          <span>
            <Kbd>C</Kbd> copy
          </span>
          <span className="ms-auto">
            Day 32 of{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://github.com/mchamow?tab=repositories">
              100 Days of React
            </a>
          </span>
        </footer>
      </main>
    </TooltipProvider>
  )
}

/**
 * The curve as CSS, editable: type or paste a value and press Enter (or leave the field) to apply it.
 * While the text doesn't parse, the curve stays put and the error explains why.
 */
function CssField({ curve, onCommit, children }: { curve: Curve; onCommit: (c: Curve) => void; children: React.ReactNode }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const parsed = parseCurve(draft)
    if (parsed.ok) {
      onCommit(parsed.curve)
      setDraft(null)
      setError(null)
    } else {
      setError(parsed.error)
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor="css-value">CSS timing function</Label>
        {children}
      </div>
      {/* A textarea so long values wrap on phones instead of hiding their end; Enter still applies. */}
      <Textarea
        id="css-value"
        rows={1}
        className="min-h-9 resize-none py-1.5 font-mono"
        spellCheck={false}
        autoComplete="off"
        value={draft ?? formatCurve(curve)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'css-error' : undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          else if (e.key === 'Escape') {
            setDraft(null)
            setError(null)
          }
        }}
        onBlur={commit}
      />
      {error && (
        <p id="css-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function CurveButton({
  curve,
  current,
  label,
  name,
  onPick,
  className,
}: {
  curve: Curve
  current: Curve
  label: string
  name?: string
  onPick: (c: Curve) => void
  className?: string
}) {
  const active = sameCurve(curve, current)
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      aria-pressed={active}
      aria-label={name}
      onClick={() => onPick(curve)}
      className={cn(
        'justify-start gap-1 px-1 font-normal sm:gap-1.5 sm:px-1.5',
        active && 'text-violet-700 ring-1 ring-violet-500/50 dark:text-violet-300',
        className,
      )}
    >
      <CurveThumb curve={curve} className="size-5 shrink-0 sm:size-6 text-violet-600 dark:text-violet-400" />
      <span className="truncate">{label}</span>
    </Button>
  )
}

function Presets({ current, onPick, className }: { current: Curve; onPick: (c: Curve) => void; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Presets</CardTitle>
        <CardDescription>CSS keywords and the classic Penner easings. Picking one plays it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="CSS keywords">
          {CSS_PRESETS.map((p) => (
            <CurveButton key={p.name} curve={p.curve} current={current} label={p.name} onPick={onPick} className="font-mono" />
          ))}
        </div>
        <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-1 gap-y-0.5">
          {FAMILIES.map((f) => (
            <div key={f.name} className="contents" role="group" aria-label={f.name}>
              <span className="pe-1 text-sm font-medium">{f.name}</span>
              {VARIANTS.map((v) => (
                <CurveButton
                  key={v.key}
                  curve={f[v.key]}
                  current={current}
                  label={v.label}
                  name={`${f.name} ${v.label}`}
                  onPick={onPick}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SavedCurves({
  className,
  saved,
  current,
  onSave,
  onPick,
  onRemove,
}: {
  className?: string
  saved: { id: number; name: string; curve: Curve }[]
  current: Curve
  onSave: (name: string) => void
  onPick: (c: Curve) => void
  onRemove: (id: number) => void
}) {
  const [name, setName] = useState('')
  const full = saved.length >= MAX_SAVED
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>My curves</CardTitle>
        <CardDescription>Kept in this browser.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(name)
            setName('')
          }}
        >
          <Input
            aria-label="Curve name"
            placeholder="Name (optional)"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={full}>
            <BookmarkPlusIcon />
            Save
          </Button>
        </form>
        {full && <p className="text-xs text-muted-foreground">That's {MAX_SAVED}, the most it keeps. Delete one to save another.</p>}
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing saved yet. Name the current curve and save it to keep it here.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-1" aria-label="Saved curves">
            {saved.map((s) => (
              <li key={s.id} className="flex min-w-0 items-center">
                <CurveButton
                  curve={s.curve}
                  current={current}
                  label={s.name}
                  name={s.name}
                  onPick={onPick}
                  className="min-w-0 flex-1"
                />
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} onClick={() => onRemove(s.id)}>
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
