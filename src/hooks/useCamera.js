import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Webcam lifecycle: request, attach, flip, release.
 *
 * start() must be triggered by a user gesture — iOS Safari rejects
 * getUserMedia calls that aren't tied to a tap.
 */
export function useCamera({ facingMode = 'user', width = 1280, height = 720 } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [status, setStatus] = useState('idle') // idle | requesting | live | error
  const [error, setError] = useState(null)
  const [facing, setFacing] = useState(facingMode)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(
    async (mode = facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError('Camera API unavailable. A secure context (HTTPS) is required.')
        return
      }

      setStatus('requesting')
      setError(null)

      // Release any existing stream first, or flipping cameras can fail on mobile.
      streamRef.current?.getTracks().forEach((t) => t.stop())

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: mode,
            width: { ideal: width },
            height: { ideal: height },
          },
        })

        streamRef.current = stream
        setFacing(mode)

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setStatus('live')
      } catch (err) {
        setStatus('error')
        setError(describeCameraError(err))
      }
    },
    [facing, width, height]
  )

  const flip = useCallback(() => {
    start(facing === 'user' ? 'environment' : 'user')
  }, [facing, start])

  // Always release the hardware on unmount — otherwise the camera LED stays on.
  useEffect(() => stop, [stop])

  return {
    videoRef,
    start,
    stop,
    flip,
    status,
    error,
    facing,
    isMirrored: facing === 'user', // selfie view must be mirrored to feel natural
  }
}

function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission denied. Enable it in your browser settings and reload.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera device found.'
    case 'NotReadableError':
      return 'Camera is in use by another app. Close it and retry.'
    case 'OverconstrainedError':
      return 'Requested camera mode is unsupported on this device.'
    default:
      return err?.message || 'Unknown camera fault.'
  }
}
