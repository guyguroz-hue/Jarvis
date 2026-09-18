import { Canvas } from '@react-three/fiber'
import { INTERACTION } from '../../lib/constants'
import HoloCore from './HoloCore'

/**
 * Transparent R3F layer (z-10), sitting between the camera feed and the HUD.
 *
 * `alpha: true` plus no scene background is what lets the webcam show through.
 * `pointer-events-none` keeps HUD buttons clickable underneath the canvas —
 * interaction here comes from hands, not taps.
 */
export default function Scene({ handsRef, videoRef, mirrored, onGesture }) {
  return (
    <Canvas
      className="pointer-events-none"
      /**
       * Positioning MUST come through `style`, not a Tailwind class. R3F sets
       * `position: relative` as an INLINE style on its container, and an inline
       * style beats a class — so an `absolute` class is silently ignored, the
       * canvas takes up flow space, and it shoves the HUD off-screen.
       */
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
      }}
      // Cap DPR at 2: past that, fill cost on phones outweighs the sharpness.
      dpr={[1, 2]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      camera={{
        position: [0, 0, INTERACTION.cameraDistance],
        fov: 50,
        near: 0.1,
        far: 100,
      }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#7dd3fc" />

      <HoloCore
        handsRef={handsRef}
        videoRef={videoRef}
        mirrored={mirrored}
        onGesture={onGesture}
      />
    </Canvas>
  )
}
