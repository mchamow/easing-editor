# 🎢 Easing Curve Editor

[![Test and deploy](https://github.com/mchamow/easing-editor/actions/workflows/deploy.yml/badge.svg)](https://github.com/mchamow/easing-editor/actions/workflows/deploy.yml)

**Day 32 of [100 Days of React](https://github.com/mchamow?tab=repositories)**: Design cubic-bezier easing curves by dragging handles and preview them live.

**Live demo:** https://mchamow.github.io/easing-editor/

## Features

- **Drag the two handles** of a `cubic-bezier()` on an SVG graph with the mouse, a pen or a finger. Pressing anywhere on the graph pulls the nearer handle there. There's room above and below the unit square for curves that overshoot
- **Keyboard editing**: <kbd>1</kbd> / <kbd>2</kbd> pick a handle, arrow keys nudge it by 0.01, <kbd>Shift</kbd>+arrows by 0.1
- **Type or paste CSS**: `cubic-bezier(0.1, 0.7, 1, 0.1)`, four bare numbers or a keyword like `ease-in-out`. <kbd>Enter</kbd> applies it, a value that won't work says why, and <kbd>Esc</kbd> throws the draft away
- **Live preview**: a box moves, scales, rotates or fades with the curve, next to a linear lane for comparison. A dot rides the curve on the graph while it plays. Duration runs from 100 ms to 3 s, with an optional loop. <kbd>Space</kbd> or <kbd>P</kbd> plays
- **29 presets**: the five CSS keywords plus the Penner easings (Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back), each as in, out and in-out, drawn as tiny curves. Picking one plays it
- **Reverse** (<kbd>R</kbd>) turns a curve into its mirror image, so ease-in becomes ease-out
- **Copy CSS** (<kbd>C</kbd>), plus a ready `transition:` line for the chosen property and duration that names the keyword when the curve is one
- **My curves**: name and save curves. They're kept in `localStorage` along with the current curve and preview settings, so a reload keeps everything
- Light and dark themes that follow the system, and a phone layout

## How it works

- [`src/bezier.ts`](src/bezier.ts): the timing function maths. `ease()` solves the curve's x for a time fraction (Newton's method, falling back to bisection) and reads off its y, the same way a browser does. Also clamping, reversing, formatting and parsing CSS
- [`src/CurveEditor.tsx`](src/CurveEditor.tsx): the graph. A timing function is itself one cubic Bézier, so the curve is a single SVG `C` path through the mapped control points. Dragging uses pointer capture on the SVG and keeps the offset from where you grabbed the handle
- [`src/playback.ts`](src/playback.ts): a `requestAnimationFrame` hook that plays a time fraction from 0 to 1. The preview is drawn from `ease(curve, t)`, so the box, the dot on the graph and the numbers always agree
- [`src/reducer.ts`](src/reducer.ts) and [`src/storage.ts`](src/storage.ts): editor state as reducer actions, and a guarded load that falls back field by field when saved data is missing or malformed

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI) · lucide icons · Vitest + Testing Library · deployed to GitHub Pages with GitHub Actions.

## Run locally

```bash
pnpm install
pnpm dev
pnpm test   # 52 unit and component tests (Vitest)
```
