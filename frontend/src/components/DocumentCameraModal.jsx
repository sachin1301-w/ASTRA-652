import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Camera, Check, FlipHorizontal, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function DocumentCameraModal({ isOpen, onClose, onCapture, onError }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fallbackInputRef = useRef(null)

  const [stream, setStream] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // Detect multiple cameras
  useEffect(() => {
    async function checkCameras() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch {
        setHasMultipleCameras(false)
      }
    }
    if (isOpen) checkCameras()
  }, [isOpen])

  // Start video stream when modal opens or facingMode changes
  useEffect(() => {
    if (!isOpen || capturedUrl) return

    let currentStream = null
    let isCancelled = false

    async function startCamera() {
      setIsInitializing(true)
      setCameraError(null)

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.')
        }

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        if (isCancelled) {
          newStream.getTracks().forEach((track) => track.stop())
          return
        }

        currentStream = newStream
        setStream(newStream)
        if (videoRef.current) {
          videoRef.current.srcObject = newStream
          videoRef.current.play().catch(() => {})
        }
      } catch (err) {
        if (isCancelled) return
        let message = 'Unable to access camera. Please check permissions in your browser settings.'
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission was denied. Please grant permission in your browser or use device upload.'
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No camera device was detected on your system.'
        }
        setCameraError(message)
      } finally {
        if (!isCancelled) setIsInitializing(false)
      }
    }

    startCamera()

    return () => {
      isCancelled = true
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOpen, facingMode, capturedUrl])

  // Stop stream when closing
  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  function handleClose() {
    stopStream()
    setCapturedUrl(null)
    setCapturedBlob(null)
    setCameraError(null)
    onClose()
  }

  function handleCapture() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current || document.createElement('canvas')

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture snapshot from camera.')
          return
        }
        const preview = URL.createObjectURL(blob)
        setCapturedUrl(preview)
        setCapturedBlob(blob)
        stopStream()
      },
      'image/jpeg',
      0.92
    )
  }

  function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedBlob(null)
  }

  function handleConfirm() {
    if (!capturedBlob) return
    const filename = `document_camera_scan_${Date.now()}.jpg`
    const file = new File([capturedBlob], filename, { type: 'image/jpeg' })
    onCapture(file)
    handleClose()
  }

  function toggleCamera() {
    stopStream()
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  function handleFallbackUpload(event) {
    const file = event.target.files?.[0]
    if (file) {
      onCapture(file)
      handleClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#00baf2]/30 bg-[#00173d] text-white shadow-2xl shadow-[#002970]/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white shadow-sm">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Document Camera Scanner</h3>
                  <p className="text-[11px] font-semibold text-white/70">
                    Align your loan contract, bill, or receipt within the frame
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close camera"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Viewfinder / Preview Area */}
            <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden bg-black sm:min-h-[420px]">
              {cameraError ? (
                <div className="flex max-w-md flex-col items-center p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Camera Access Notice</h4>
                  <p className="mt-1.5 text-xs text-white/70">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => fallbackInputRef.current?.click()}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#002970] to-[#00baf2] px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform hover:scale-105"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Capture with Device Camera App</span>
                  </button>
                </div>
              ) : capturedUrl ? (
                /* Captured Still Review */
                <div className="relative h-full w-full">
                  <img
                    src={capturedUrl}
                    alt="Captured document preview"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    Scan Snapshot Preview
                  </div>
                </div>
              ) : (
                /* Live Video Viewfinder */
                <div className="relative h-full w-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {/* Document Framing Reticle */}
                  <div className="pointer-events-none absolute inset-6 sm:inset-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#00baf2]/70">
                    {/* Viewfinder Corners */}
                    <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-[#00baf2] rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-[#00baf2] rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-[#00baf2] rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-[#00baf2] rounded-br-lg" />

                    {/* Animated Scanning Laser */}
                    <div className="animate-laser-scan" />

                    <div className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-sm">
                      Fit document inside frame
                    </div>
                  </div>

                  {isInitializing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <RefreshCw className="h-4 w-4 animate-spin text-[#00baf2]" />
                        <span>Starting camera feed...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden Canvas for High-Resolution Capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Hidden Fallback Input for mobile camera upload */}
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFallbackUpload}
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-white/10 bg-[#00112e] px-6 py-4">
              {capturedUrl ? (
                /* Review Actions */
                <div className="flex w-full items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/20"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retake Photo</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00baf2] to-[#0041a8] px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-[#00baf2]/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Check className="h-4 w-4" />
                      <span>Use This Scan</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Live Capture Actions */
                <div className="flex w-full items-center justify-between">
                  <div>
                    {hasMultipleCameras && (
                      <button
                        type="button"
                        onClick={toggleCamera}
                        title="Switch between front and back cameras"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/90 hover:bg-white/20"
                      >
                        <FlipHorizontal className="h-4 w-4 text-[#00baf2]" />
                        <span className="hidden sm:inline">Flip Camera</span>
                      </button>
                    )}
                  </div>

                  {/* Primary Shutter Button */}
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    disabled={Boolean(cameraError) || isInitializing}
                    onClick={handleCapture}
                    aria-label="Capture document photo"
                    className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-gradient-to-tr from-[#002970] via-[#0041a8] to-[#00baf2] text-white shadow-xl shadow-[#00baf2]/30 disabled:opacity-50"
                  >
                    <div className="h-4 w-4 rounded-full bg-white shadow-xs" />
                  </motion.button>

                  {/* Fallback device file camera button */}
                  <button
                    type="button"
                    onClick={() => fallbackInputRef.current?.click()}
                    title="Open native device camera"
                    className="text-xs font-semibold text-white/60 underline underline-offset-4 hover:text-white"
                  >
                    Device App
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
