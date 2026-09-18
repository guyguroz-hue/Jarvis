# J.A.R.V.I.S. — Spatial HUD

A browser-based, real-time AR heads-up display: webcam passthrough, MediaPipe hand
tracking mapped into a React Three Fiber scene, a glassmorphism HUD, and a
voice-driven AI assistant.

## Stack

| Layer      | Tech                                  |
| ---------- | ------------------------------------- |
| Build      | Vite 5 + React 18                     |
| Styling    | Tailwind CSS 3                        |
| 3D         | React Three Fiber 8, Drei 9, Three.js |
| Vision     | @mediapipe/tasks-vision               |
| Voice      | Web Speech API (STT + TTS)            |
| AI         | SiliconFlow (OpenAI-compatible API)   |

## Build phases

- [x] **Phase 1** — Architecture, toolchain, HUD shell
- [x] **Phase 2** — AR camera layer + MediaPipe hand-tracking hook
- [ ] **Phase 3** — R3F canvas, hand coords mapped to a 3D object
- [ ] **Phase 4** — Sci-fi HUD panels (telemetry, logs)
- [ ] **Phase 5** — Voice hooks + SiliconFlow brain
- [ ] **Phase 6** — Full integration

## Layering model

The interface is three stacked full-screen layers:

```
z-0   <video>   AR camera feed          (Phase 2) ✅
z-5   <canvas>  hand skeleton overlay   (Phase 2) ✅
z-10  <Canvas>  React Three Fiber scene (Phase 3)
z-20  <div>     Tailwind HUD overlay    (Phase 4)
```

### Tracking performance contract

Per-frame landmark data is written to a **ref** (`handsRef`), never to React
state. Calling `setState` at 60 fps would re-render the tree 60 times a second.
Consumers needing per-frame data read `handsRef.current` inside `useFrame` or
their own `requestAnimationFrame` loop, outside React's render cycle. Only
summary data (hand count, FPS) reaches state, throttled to 10 Hz.

## Structure

```
api/                  Vercel serverless functions (AI proxy — Phase 5)
src/
  components/
    ar/               camera feed
    three/            R3F scene + objects
    hud/              Tailwind overlay panels
  hooks/              useHandTracking, useSpeech, useAI
  lib/                constants, helpers
  App.jsx             layer composition
  main.jsx            entry point
```

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
```

`server.host` is enabled, so the dev server also prints a LAN address you can
open on a phone to test the camera.

## Deploying to Vercel

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel auto-detects
Vite — no configuration needed.

| Setting          | Value           |
| ---------------- | --------------- |
| Framework preset | Vite            |
| Build command    | `npm run build` |
| Output directory | `dist`          |

## A note on the API key

The SiliconFlow key must **never** be exposed as a `VITE_*` variable — anything
prefixed `VITE_` is inlined into the public JS bundle and readable by any
visitor. From Phase 5 the key is set in Vercel as `SILICONFLOW_API_KEY`
(no `VITE_` prefix) and used only inside `api/chat.js`, server-side.

## Browser requirements

Camera and microphone access require a **secure context** — HTTPS or
`localhost`. Vercel serves HTTPS by default. Speech recognition support is
strongest in Chrome and Edge.
