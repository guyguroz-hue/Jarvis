import { useCallback, useEffect, useRef, useState } from 'react'
import { MEDIAPIPE } from '../lib/constants'
import {
  handScale,
  palmCenter,
  pinchLatch,
  pinchPoint,
  pinchStrength,
  pinchStrength3D,
  smooth,
} from '../lib/handUtils'

/**
 * Real-time hand tracking driven by requestAnimationFrame.
 *
 * PERFORMANCE CONTRACT — the important part of this file:
 *
 *   Per-frame landmark data is written to `handsRef` (a ref), NOT to state.
 *   Calling setState 60x/second would re-render the entire React tree 60x/second
 *   and make the HUD stutter. Consumers that need per-frame data (the R3F scene
 *   in Phase 3) read `handsRef.current` inside useFrame, which runs outside
 *   React's render cycle entirely.
 *
 *   Only cheap, low-frequency summary data (hand count, fps) is mirrored into
 *   React state, throttled to TELEMETRY_HZ.
 */
export function useHandTracking(videoRef, { enabled = false, maxHands = MEDIAPIPE.maxHands } = {}) {
  const handsRef = useRef({ hands: [], timestamp: 0 })

  const landmarkerRef = useRef(null)
  const rafRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const lastTimestampRef = useRef(0)
  const smoothedPinchRef = useRef([])
  const latchedRef = useRef([]) // per-hand pinch state, for the Schmitt trigger

  // Grab persistence across tracking dropouts.
  const lastHandsRef = useRef([])
  const lastSeenRef = useRef(0)

  // FPS accounting
  const frameCountRef = useRef(0)
  const lastFpsSampleRef = useRef(0)
  const lastTelemetryRef = useRef(0)

  const [status, setStatus] = useState('idle') // idle | loading | tracking | error
  const [error, setError] = useState(null)
  const [telemetry, setTelemetry] = useState({ handCount: 0, fps: 0, delegate: null })

  /** Load the WASM runtime + model. GPU first, CPU as a fallback. */
  const load = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current

    setStatus('loading')
    setError(null)

    // Dynamic import keeps the MediaPipe bundle out of the initial page load.
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmPath)

    const build = (delegate) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MEDIAPIPE.modelPath, delegate },
        runningMode: 'VIDEO',
        numHands: maxHands,
        minHandDetectionConfidence: MEDIAPIPE.detectionConfidence,
        minHandPresenceConfidence: MEDIAPIPE.presenceConfidence,
        minTrackingConfidence: MEDIAPIPE.trackingConfidence,
      })

    let delegate = 'GPU'
    let landmarker
    try {
      landmarker = await build('GPU')
    } catch (gpuErr) {
      // Plenty of mobile GPUs reject the WebGL delegate. CPU is slower but works.
      console.warn('[JARVIS] GPU delegate unavailable, falling back to CPU:', gpuErr)
      delegate = 'CPU'
      landmarker = await build('CPU')
    }

    landmarkerRef.current = landmarker
    setTelemetry((t) => ({ ...t, delegate }))
    return landmarker
  }, [maxHands])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < 2 || !video.videoWidth) return

      // Only run inference when the video has actually advanced. Re-running on
      // the same frame wastes GPU time and can trip MediaPipe's timestamp guard.
      if (video.currentTime === lastVideoTimeRef.current) return
      lastVideoTimeRef.current = video.currentTime

      // detectForVideo requires strictly increasing timestamps.
      let ts = performance.now()
      if (ts <= lastTimestampRef.current) ts = lastTimestampRef.current + 1
      lastTimestampRef.current = ts

      let result
      try {
        result = landmarker.detectForVideo(video, ts)
      } catch (err) {
        console.error('[JARVIS] detection fault:', err)
        return
      }

      const raw = result?.landmarks ?? []
      // API shape differs slightly across tasks-vision releases.
      const handedness = result?.handedness ?? result?.handednesses ?? []

      let hands = raw.map((landmarks, i) => {
        const world = result.worldLandmarks?.[i] ?? null

        // Prefer the metric 3D reconstruction: unlike the projected 2D version
        // it does not change when the hand rotates.
        const target = world ? pinchStrength3D(world) : pinchStrength(landmarks)

        smoothedPinchRef.current[i] = smooth(smoothedPinchRef.current[i], target, 0.45)
        const pinch = smoothedPinchRef.current[i]

        const isPinching = pinchLatch(pinch, latchedRef.current[i] ?? false, {
          enter: MEDIAPIPE.pinchEnter,
          exit: MEDIAPIPE.pinchExit,
        })
        latchedRef.current[i] = isPinching

        return {
          landmarks,
          worldLandmarks: world,
          // NOTE: handedness is reported for the RAW frame. In a mirrored selfie
          // view this reads inverted from the user's point of view.
          handedness: handedness[i]?.[0]?.categoryName ?? 'Unknown',
          pinch,
          isPinching,
          pinchSource: world ? '3d' : '2d',
          stale: false,
          palm: palmCenter(landmarks),
          pinchPoint: pinchPoint(landmarks),
          // Apparent palm size — used as a stable depth proxy (see projection.js).
          scale: handScale(landmarks),
        }
      })

      if (hands.length) {
        lastHandsRef.current = hands
        lastSeenRef.current = ts
        smoothedPinchRef.current.length = hands.length
        latchedRef.current.length = hands.length
      } else {
        /**
         * GRAB PERSISTENCE.
         *
         * MediaPipe drops a hand once part of it leaves the frame, which would
         * otherwise kill an in-progress grab the moment the wrist clips the
         * screen edge. If the hand was pinching when we lost it, keep
         * republishing its last known state for a short grace window, flagged
         * stale so consumers can render it as a ghost and decide for
         * themselves. Hands that were merely open are dropped immediately.
         */
        const held = lastHandsRef.current.filter((h) => h.isPinching)
        const elapsed = ts - lastSeenRef.current
        if (held.length && elapsed < MEDIAPIPE.trackingGraceMs) {
          hands = held.map((h) => ({ ...h, stale: true, staleFor: elapsed }))
        } else {
          lastHandsRef.current = []
          smoothedPinchRef.current.length = 0
          latchedRef.current.length = 0
        }
      }

      handsRef.current = { hands, timestamp: ts }

      // ---- throttled telemetry (the ONLY state written during tracking) ----
      frameCountRef.current++
      if (ts - lastFpsSampleRef.current >= 1000) {
        const fps = frameCountRef.current
        frameCountRef.current = 0
        lastFpsSampleRef.current = ts
        setTelemetry((t) => (t.fps === fps ? t : { ...t, fps }))
      }
      if (ts - lastTelemetryRef.current >= 1000 / MEDIAPIPE.telemetryHz) {
        lastTelemetryRef.current = ts
        setTelemetry((t) =>
          t.handCount === hands.length ? t : { ...t, handCount: hands.length }
        )
      }
    }

    load()
      .then(() => {
        if (cancelled) return
        setStatus('tracking')
        lastFpsSampleRef.current = performance.now()
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[JARVIS] tracker init failed:', err)
        setStatus('error')
        setError(err?.message || 'Failed to load hand tracking model.')
      })

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      handsRef.current = { hands: [], timestamp: 0 }
      smoothedPinchRef.current = []
      latchedRef.current = []
      lastHandsRef.current = []
      lastSeenRef.current = 0
      lastVideoTimeRef.current = -1
      setStatus('idle')
      setTelemetry((t) => ({ ...t, handCount: 0, fps: 0 }))
    }
  }, [enabled, videoRef, load])

  // Release the native MediaPipe handle when the hook is torn down for good.
  useEffect(() => {
    return () => {
      landmarkerRef.current?.close?.()
      landmarkerRef.current = null
    }
  }, [])

  return { handsRef, status, error, telemetry }
}
