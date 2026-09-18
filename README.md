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
- [x] **Phase 3** — R3F canvas, hand coords mapped to a 3D object
- [x] **Phase 4** — Sci-fi HUD panels (telemetry, logs)
- [x] **Phase 5** — Voice hooks + SiliconFlow brain
- [ ] **Phase 6** — Full integration

## Layering model

The interface is three stacked full-screen layers:

```
z-0   <video>   AR camera feed          (Phase 2) ✅
z-5   <canvas>  hand skeleton overlay   (Phase 2) ✅
z-10  <Canvas>  React Three Fiber scene (Phase 3) ✅
z-14  frame / z-15 reticle              (Phase 4) ✅
z-20  <div>     Tailwind HUD overlay    (Phase 4) ✅
```

### Coordinate projection

`src/lib/projection.js` is the single source of truth for landmark -> screen ->
world mapping, and every consumer must go through it.

MediaPipe reports landmarks normalized to the **raw video frame**, but the feed
is rendered with `object-cover`, which crops to fill the viewport. On a portrait
phone showing a 1280x720 stream only ~26% of the video width is actually on
screen — so mapping a landmark straight to screen space misplaces it badly.
`projectLandmark()` compensates for that crop and for selfie mirroring.

Run `npm test` to exercise the projection maths.

### HUD conventions

- **Form follows the measure.** Bounded 0..1 values (pinch) get an arc meter;
  change-over-time (frame rate) gets a sparkline; single headline values
  (uptime, power, link) get stat tiles rather than decorative gauges.
- **Status is never colour alone.** The status hues separate by only ΔE 7.3
  between amber and green under protanopia, so every state ships a text label
  too — `ONLINE`/`STANDBY`, `PINCH`/`HOLD`, and the `SYS`/`OK`/`WRN`/`ERR` log
  tags. Contrast against the panel surface passes at >= 3:1 for all four.
- **Unsupported readings are omitted, never faked.** Battery and network are
  Chrome/Android only; those tiles simply do not render elsewhere.
- **Density toggle.** `MIN` strips the HUD back to header and footer, for an
  unobstructed AR view on a small screen.

### Gesture robustness

Three properties the naive implementation lacked:

- **Rotation invariance.** Pinch strength is measured on MediaPipe's
  `worldLandmarks` — metric 3D coordinates in metres — not on projected 2D
  points. A projected measurement foreshortens as the hand turns, so a closed
  pinch reads as open past roughly 70 degrees of tilt. See
  `handUtils.test.js`.
- **Hysteresis.** `pinchLatch()` is a Schmitt trigger: engaging a pinch needs a
  firmer grip than holding one. A single threshold chatters when the signal
  hovers near it.
- **Grab persistence.** MediaPipe drops a hand once part of it leaves frame.
  A hand that was pinching keeps being republished for `trackingGraceMs` with
  `stale: true`, so a grab survives the dropout instead of dying when the wrist
  clips the screen edge. Stale hands render as faded ghosts.

Position is smoothed with a **One Euro filter** (`lib/filters.js`) rather than a
fixed lerp, which cannot be both jitter-free at rest and low-lag in motion.

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
npm test         # projection maths
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

## Configuring the AI

Set these in **Vercel → Project → Settings → Environment Variables**, then
redeploy. None of them carry a `VITE_` prefix, and that is the point: anything
prefixed `VITE_` is inlined into the public JS bundle and readable by any
visitor. These are read only inside `api/chat.js`, server-side.

| Variable | Required | Default |
| --- | --- | --- |
| `SILICONFLOW_API_KEY` | yes | — |
| `SILICONFLOW_MODEL` | no | `Qwen/Qwen2.5-7B-Instruct` |
| `SILICONFLOW_BASE_URL` | no | `https://api.siliconflow.cn/v1` |

### Endpoint exposure

`/api/chat` is unauthenticated. Anyone who finds the URL can spend your API
credit. The function caps conversation length, message count and `max_tokens`,
and rejects cross-origin requests — but an `Origin` header is trivially forged
outside a browser, so treat these as damage limiting, not access control. If
the deployment is ever public, put real authentication in front of it.

## Voice

- Recognition is Chrome/Edge/Safari only — **Firefox has no SpeechRecognition**.
- Continuous listening is gated on a wake word (`lib/wake.js`); the mic never
  acts on ordinary conversation.
- Recognition is suspended for the duration of every spoken reply. Without
  that, the microphone transcribes the synthesised voice and the assistant
  answers itself in a loop.
- "Continuous" listening is really a restart loop, because browsers end
  sessions on their own. It does not restart after a permanent failure such as
  a denied microphone.
- iOS gates the first utterance behind a user gesture, so arming the voice
  speaks a silent utterance from inside the tap to unlock synthesis.

## Browser requirements

Camera and microphone access require a **secure context** — HTTPS or
`localhost`. Vercel serves HTTPS by default. Speech recognition support is
strongest in Chrome and Edge.
