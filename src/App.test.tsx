import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './storage'

// The graph's viewBox, which the stubbed bounding box matches 1:1 so client coordinates are viewBox units.
const VB = { w: 356, h: 403 }
const at = (x: number, y: number) => ({ clientX: 28 + x * 300, clientY: 14 + (1.75 - y) * 150 })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const handle = (n: 1 | 2) => button(new RegExp(`^Handle ${n}:`))
const cssField = () => screen.getByLabelText('CSS timing function') as HTMLTextAreaElement
const graph = () => screen.getByRole('group', { name: 'Curve graph' })
const sw = (name: string) => screen.getByRole('switch', { name })
const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key, ...init })
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')

function setCss(text: string) {
  fireEvent.change(cssField(), { target: { value: text } })
  fireEvent.keyDown(cssField(), { key: 'Enter' })
}

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: VB.w,
    height: VB.h,
    right: VB.w,
    bottom: VB.h,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('editing the curve', () => {
  it('starts on ease', () => {
    render(<App />)
    expect(cssField().value).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
    expect(handle(1).getAttribute('aria-label')).toBe('Handle 1: x 0.25, y 0.1')
    expect(handle(2).getAttribute('aria-label')).toBe('Handle 2: x 0.25, y 1')
    expect(screen.getByText('same as ease')).toBeTruthy()
    expect(button('ease').getAttribute('aria-pressed')).toBe('true')
  })

  it('drags a handle with the pointer, keeping the grab offset', () => {
    render(<App />)
    const svg = graph()
    // Grab handle 2 a little right of its centre (0.25, 1) and drag it.
    fireEvent.pointerDown(handle(2).querySelector('circle')!, { ...at(0.27, 1), pointerId: 1 })
    fireEvent.pointerMove(svg, { ...at(0.62, 1.2), pointerId: 1 })
    fireEvent.pointerUp(svg, { ...at(0.62, 1.2), pointerId: 1 })
    expect(cssField().value).toBe('cubic-bezier(0.25, 0.1, 0.6, 1.2)')
    expect(document.activeElement).toBe(handle(2))
    // Moving after the release does nothing.
    fireEvent.pointerMove(svg, { ...at(0.9, 0.1), pointerId: 1 })
    expect(cssField().value).toBe('cubic-bezier(0.25, 0.1, 0.6, 1.2)')
  })

  it('pulls the nearest handle to a press on the graph and clamps it to the edges', () => {
    render(<App />)
    fireEvent.pointerDown(graph(), { ...at(0.4, -0.3), pointerId: 2 })
    expect(cssField().value).toBe('cubic-bezier(0.4, -0.3, 0.25, 1)')
    fireEvent.pointerMove(graph(), { ...at(-0.5, -3), pointerId: 2 })
    expect(cssField().value).toBe('cubic-bezier(0, -0.75, 0.25, 1)')
    fireEvent.pointerUp(graph(), { pointerId: 2 })
  })

  it('nudges a focused handle with the arrow keys, Shift for bigger steps', () => {
    render(<App />)
    fireEvent.keyDown(handle(1), { key: 'ArrowRight' })
    fireEvent.keyDown(handle(1), { key: 'ArrowUp', shiftKey: true })
    expect(handle(1).getAttribute('aria-label')).toBe('Handle 1: x 0.26, y 0.2')
    fireEvent.keyDown(handle(2), { key: 'ArrowDown' })
    fireEvent.keyDown(handle(2), { key: 'ArrowLeft', shiftKey: true })
    expect(cssField().value).toBe('cubic-bezier(0.26, 0.2, 0.15, 0.99)')
  })

  it('focuses a handle with 1 and 2', () => {
    render(<App />)
    press('2')
    expect(document.activeElement).toBe(handle(2))
    press('1')
    expect(document.activeElement).toBe(handle(1))
  })

  it('applies typed CSS on Enter, keywords included', () => {
    render(<App />)
    setCss('cubic-bezier(0.1, 0.7, 1.0, 0.1)')
    expect(handle(2).getAttribute('aria-label')).toBe('Handle 2: x 1, y 0.1')
    expect(cssField().value).toBe('cubic-bezier(0.1, 0.7, 1, 0.1)')
    setCss('ease-in-out')
    expect(button('ease-in-out').getAttribute('aria-pressed')).toBe('true')
  })

  it('explains bad CSS, keeps the curve, and Escape throws the draft away', () => {
    render(<App />)
    setCss('1.5, 0, 1, 1')
    expect(screen.getByText('The x values must be between 0 and 1.')).toBeTruthy()
    expect(cssField().getAttribute('aria-invalid')).toBe('true')
    expect(handle(1).getAttribute('aria-label')).toBe('Handle 1: x 0.25, y 0.1')
    fireEvent.keyDown(cssField(), { key: 'Escape' })
    expect(cssField().value).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
    expect(screen.queryByText(/x values/)).toBeNull()
  })

  it('commits typed CSS when the field loses focus', () => {
    render(<App />)
    fireEvent.change(cssField(), { target: { value: '0 0 1 1' } })
    fireEvent.blur(cssField())
    expect(button('linear').getAttribute('aria-pressed')).toBe('true')
  })

  it('reverses with the button and with R', () => {
    render(<App />)
    setCss('ease-in')
    fireEvent.click(button(/Reverse/))
    expect(button('ease-out').getAttribute('aria-pressed')).toBe('true')
    press('r')
    expect(button('ease-in').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('presets and saved curves', () => {
  it('applies a preset and plays it', () => {
    render(<App />)
    fireEvent.click(button('Back Out'))
    expect(cssField().value).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)')
    expect(button('Back Out').getAttribute('aria-pressed')).toBe('true')
    expect(button('ease').getAttribute('aria-pressed')).toBe('false')
    expect(button(/^Stop/)).toBeTruthy()
  })

  it('saves, recalls and deletes curves, and keeps them after a reload', () => {
    const { unmount } = render(<App />)
    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy()
    fireEvent.click(button('Expo In-Out'))
    fireEvent.change(screen.getByLabelText('Curve name'), { target: { value: 'Swoosh' } })
    fireEvent.click(button(/^Save/))
    expect((screen.getByLabelText('Curve name') as HTMLInputElement).value).toBe('')
    fireEvent.click(button('Sine In'))
    fireEvent.click(button(/^Save/))
    const list = screen.getByRole('list', { name: 'Saved curves' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByRole('button', { name: 'Curve 2' })).toBeTruthy()

    unmount()
    render(<App />)
    // The last curve comes back too.
    expect(button('Sine In').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button('Swoosh'))
    expect(cssField().value).toBe('cubic-bezier(0.87, 0, 0.13, 1)')
    fireEvent.click(button('Delete Swoosh'))
    expect(screen.queryByRole('button', { name: 'Swoosh' })).toBeNull()
    expect(stored().saved).toHaveLength(1)
  })

  it('does not fire shortcuts while typing a name', () => {
    render(<App />)
    const name = screen.getByLabelText('Curve name')
    fireEvent.keyDown(name, { key: 'c' })
    fireEvent.keyDown(name, { key: 'r' })
    fireEvent.keyDown(name, { key: 'p' })
    expect(writeText).not.toHaveBeenCalled()
    expect(button('ease').getAttribute('aria-pressed')).toBe('true')
    expect(button(/^Play/)).toBeTruthy()
  })
})

describe('copying', () => {
  it('copies the CSS with the button and with C', async () => {
    render(<App />)
    await act(async () => fireEvent.click(button(/Copy CSS/)))
    expect(writeText).toHaveBeenCalledWith('cubic-bezier(0.25, 0.1, 0.25, 1)')
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard')
    fireEvent.keyDown(handle(1), { key: 'ArrowUp' })
    await act(async () => press('c'))
    expect(writeText).toHaveBeenLastCalledWith('cubic-bezier(0.25, 0.11, 0.25, 1)')
  })

  it('says so when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<App />)
    await act(async () => fireEvent.click(button(/Copy CSS/)))
    expect(screen.getByRole('status').textContent).toMatch(/Copy failed/)
  })

  it('shows the transition line for the property and duration', () => {
    render(<App />)
    expect(screen.getByText('transition: transform 1s ease;')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fade' }))
    fireEvent.keyDown(screen.getByLabelText('Duration', { selector: 'input[type=range]' }), { key: 'ArrowLeft' })
    setCss('0.5, 0, 0.5, 1')
    expect(screen.getByText('transition: opacity 950ms cubic-bezier(0.5, 0, 0.5, 1);')).toBeTruthy()
  })
})

describe('preview', () => {
  it('plays to the end on Play, Space and P, then stops', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(button(/^Play/))
    expect(button(/^Stop/)).toBeTruthy()
    act(() => vi.advanceTimersByTime(500))
    // Halfway through, ease is about 80% of the way there.
    expect(screen.getByText(/progress 0\.[7-8]\d/)).toBeTruthy()
    expect(screen.getByTestId('lane-curve').lastElementChild!.getAttribute('style')).toMatch(/left: calc\(8% \+ 0\.[7-8]\d* \* \(84% - 2\.5rem\)\)/)
    act(() => vi.advanceTimersByTime(700))
    expect(button(/^Play/)).toBeTruthy()
    expect(screen.getByText(/time 1\.00 → progress 1\.00/)).toBeTruthy()

    press(' ')
    expect(button(/^Stop/)).toBeTruthy()
    press('p')
    expect(button(/^Play/)).toBeTruthy()
    expect(screen.getByText(/time 0\.00 → progress 0\.00/)).toBeTruthy()
  })

  it('keeps going when looping', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(sw('Loop'))
    expect(sw('Loop').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(button(/^Play/))
    act(() => vi.advanceTimersByTime(5000))
    expect(button(/^Stop/)).toBeTruthy()
    expect(stored().loop).toBe(true)
  })

  it('switches the animated property and hides the linear lane', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Scale' }))
    expect(screen.getByTestId('lane-curve').lastElementChild!.getAttribute('style')).toMatch(/scale\(0\.2\)/)
    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))
    expect(screen.getByTestId('lane-curve').lastElementChild!.getAttribute('style')).toMatch(/rotate\(0deg\)/)
    expect(screen.getByTestId('lane-linear')).toBeTruthy()
    fireEvent.click(sw('Compare with linear'))
    expect(screen.queryByTestId('lane-linear')).toBeNull()
    expect(stored()).toMatchObject({ property: 'rotate', compare: false })
  })

  it('changes the duration with the slider and remembers it', () => {
    const { unmount } = render(<App />)
    const slider = () => screen.getByLabelText('Duration', { selector: 'input[type=range]' })
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    fireEvent.keyDown(slider(), { key: 'PageUp' })
    expect(slider().getAttribute('aria-valuetext')).toBe('1550 milliseconds')
    unmount()
    render(<App />)
    expect(slider().getAttribute('aria-valuetext')).toBe('1550 milliseconds')
  })
})
