import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INTERACTION } from '../../lib/constants'
import { depthFromHandScale, projectLandmark, screenToWorld } from '../../lib/projection'
import { Vec3Filter } from '../../lib/filters'

const HOME = new THREE.Vector3(0, 0, 0)

/**
 * The holographic core: a low-poly reactor the hands can grab and scale.
 *
 * Reads handsRef INSIDE useFrame. That is the whole point of the ref-based
 * tracking design — this runs on the render loop, outside React, so the object
 * follows the hand at full frame rate without triggering a single re-render.
 */
export default function HoloCore({ handsRef, videoRef, mirrored = true, onGesture }) {
  const group = useRef()
  const core = useRef()
  const shell = useRef()
  const ringA = useRef()
  const ringB = useRef()

  // Mutable interaction state. A ref, not state — it mutates every frame.
  const st = useRef({
    grabbed: false,
    scale: 1,
    targetScale: 1,
    twoHandBase: null, // { distance, scale } captured when two-hand scaling starts
    target: new THREE.Vector3(),
    lastGesture: null,
  })

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), f: {} }), [])

  // Adaptive smoothing for the grab target: heavy when the hand is still,
  // barely any lag when it moves fast. A plain lerp cannot do both.
  const smoother = useMemo(() => new Vec3Filter(INTERACTION.filter), [])

  /** Pinch point of a hand -> world position. */
  const handToWorld = (hand, camera, size, video, out) => {
    const s = projectLandmark(
      hand.pinchPoint,
      video?.videoWidth ?? 0,
      video?.videoHeight ?? 0,
      size.width,
      size.height,
      mirrored
    )
    const w = screenToWorld(s.x, s.y, camera, INTERACTION.cameraDistance)
    return out.set(w.x, w.y, depthFromHandScale(hand.scale))
  }

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    // delta can spike after a tab is backgrounded; clamp so nothing lurches.
    const dt = Math.min(delta, 0.1)
    const s = st.current
    const { camera, size } = state
    const video = videoRef?.current

    const hands = handsRef.current.hands
    const pinching = hands.filter((h) => h.isPinching)

    let gesture = 'idle'

    // A stale hand is one MediaPipe lost mid-grab; the tracker republishes it
    // briefly so the interaction survives the dropout.
    const holding = hands.some((h) => h.stale)

    if (pinching.length >= 2) {
      // ---- two-hand scale ----
      handToWorld(pinching[0], camera, size, video, tmp.a)
      handToWorld(pinching[1], camera, size, video, tmp.b)
      const spread = tmp.a.distanceTo(tmp.b)

      if (!s.twoHandBase) s.twoHandBase = { spread, scale: s.scale }

      const ratio = spread / Math.max(s.twoHandBase.spread, 1e-3)
      s.targetScale = THREE.MathUtils.clamp(
        s.twoHandBase.scale * ratio,
        INTERACTION.minScale,
        INTERACTION.maxScale
      )

      // Keep the core centred between both hands while scaling.
      s.target.copy(tmp.a).add(tmp.b).multiplyScalar(0.5)
      s.grabbed = true
      gesture = 'scale'
    } else {
      s.twoHandBase = null

      if (pinching.length === 1) {
        handToWorld(pinching[0], camera, size, video, tmp.a)
        // Latch on only if the pinch happens near the core; once grabbed, keep it.
        if (s.grabbed || tmp.a.distanceTo(g.position) < INTERACTION.grabRadius * s.scale) {
          s.grabbed = true
          s.target.copy(tmp.a)
          gesture = 'grab'
        }
      } else {
        s.grabbed = false
      }
    }

    // ---- motion ----
    if (s.grabbed) {
      // Filter in world space, then ease in — One Euro kills jitter, the lerp
      // adds a little inertia so the core feels like an object, not a cursor.
      const f = smoother.filter(s.target, state.clock.elapsedTime, tmp.f)
      tmp.b.set(f.x, f.y, f.z)
      g.position.lerp(tmp.b, INTERACTION.followLerp)
      if (holding) gesture = 'hold'
    } else {
      smoother.reset()
      g.position.lerp(HOME, INTERACTION.releaseLerp)
      // Gentle idle bob, only when not held.
      g.position.y += Math.sin(state.clock.elapsedTime * 1.1) * 0.0012
      s.targetScale = 1
    }

    s.scale = THREE.MathUtils.lerp(s.scale, s.targetScale, INTERACTION.scaleLerp)
    g.scale.setScalar(s.scale)

    // ---- spin ----
    const spin = s.grabbed ? INTERACTION.grabSpin : INTERACTION.idleSpin
    if (core.current) core.current.rotation.y += spin * dt
    if (shell.current) {
      shell.current.rotation.y -= spin * 0.6 * dt
      shell.current.rotation.x += spin * 0.25 * dt
    }
    if (ringA.current) ringA.current.rotation.z += spin * 0.8 * dt
    if (ringB.current) ringB.current.rotation.z -= spin * 0.5 * dt

    // Emissive intensity tracks grab state.
    if (core.current) {
      const mat = core.current.material
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        s.grabbed ? 2.4 : 1.1,
        0.12
      )
    }

    // Report gesture changes upward — but only on CHANGE, never per frame.
    if (gesture !== s.lastGesture) {
      s.lastGesture = gesture
      onGesture?.(gesture)
    }
  })

  return (
    <group ref={group}>
      {/* Inner core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial
          color="#0e7490"
          emissive="#22d3ee"
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.6}
          flatShading
        />
      </mesh>

      {/* Wireframe shell */}
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Orbit rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[0.75, 0.008, 8, 64]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.7, 0.6, 0]}>
        <torusGeometry args={[0.92, 0.006, 8, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} />
      </mesh>

      <pointLight color="#22d3ee" intensity={4} distance={6} />
    </group>
  )
}
