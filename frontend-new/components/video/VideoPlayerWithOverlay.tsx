'use client'

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { cn } from '@/lib/utils'
import { formatTime, getRiskColor } from '@/lib/utils'
import type { Track, OverlaySettings, RiskScore } from '@/lib/types'
import { generateFrameDetections, generateHeatmapData } from '@/lib/trackUtils'

export interface VideoPlayerHandle {
  seekTo: (time: number) => void
  play: () => void
  pause: () => void
  getCurrentTime: () => number
}

interface VideoPlayerWithOverlayProps {
  videoSrc?: string
  tracks?: Track[]
  riskScores?: RiskScore[]
  overlaySettings: OverlaySettings
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
  className?: string
}

export const VideoPlayerWithOverlay = forwardRef<
  VideoPlayerHandle,
  VideoPlayerWithOverlayProps
>(
  (
    {
      videoSrc,
      tracks = [],
      riskScores = [],
      overlaySettings,
      onTimeUpdate,
      onDurationChange,
      className,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isLoaded, setIsLoaded] = useState(false)
    const [heatmapData, setHeatmapData] = useState<number[][] | null>(null)

    // Generate heatmap data when tracks change
    useEffect(() => {
      if (tracks.length > 0 && overlaySettings.showHeatmap) {
        const data = generateHeatmapData(tracks, 20)
        setHeatmapData(data)
      }
    }, [tracks, overlaySettings.showHeatmap])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time
          setCurrentTime(time)
        }
      },
      play: () => {
        videoRef.current?.play()
      },
      pause: () => {
        videoRef.current?.pause()
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0
      },
    }))

    // Draw overlays on canvas
    const drawOverlays = useCallback(() => {
      const canvas = canvasRef.current
      const video = videoRef.current
      const container = containerRef.current

      if (!canvas || !video || !container) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Match canvas size to video display size
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw heatmap if enabled
      if (overlaySettings.showHeatmap && heatmapData) {
        const gridSize = heatmapData.length
        const cellWidth = canvas.width / gridSize
        const cellHeight = canvas.height / gridSize

        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const intensity = heatmapData[y][x]
            if (intensity > 0.1) {
              ctx.fillStyle = `rgba(59, 130, 246, ${intensity * 0.4})`
              ctx.fillRect(
                x * cellWidth,
                y * cellHeight,
                cellWidth,
                cellHeight
              )
            }
          }
        }
      }

      // Draw player/ball bounding boxes if enabled
      if (overlaySettings.showPlayers || overlaySettings.showBall) {
        const detections = generateFrameDetections(currentTime, tracks)

        detections.forEach((detection) => {
          const isPlayer = detection.id.startsWith('p_')
          const isBall = detection.id === 'ball'

          if ((isPlayer && !overlaySettings.showPlayers) ||
              (isBall && !overlaySettings.showBall)) {
            return
          }

          const { bbox } = detection
          const x = bbox.x * canvas.width
          const y = bbox.y * canvas.height
          const width = bbox.width * canvas.width
          const height = bbox.height * canvas.height

          // Draw bounding box
          ctx.strokeStyle = isPlayer ? '#3b82f6' : '#eab308'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)

          // Draw track ID if enabled
          if (overlaySettings.showTrackIds && isPlayer) {
            ctx.fillStyle = '#3b82f6'
            ctx.fillRect(x, y - 18, 30, 18)
            ctx.fillStyle = '#ffffff'
            ctx.font = '12px Inter, sans-serif'
            ctx.fillText(detection.id, x + 4, y - 5)
          }

          // Draw confidence badge
          if (detection.confidence > 0) {
            const confText = `${Math.round(detection.confidence * 100)}%`
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
            ctx.fillRect(x, y + height + 2, 35, 14)
            ctx.fillStyle = '#ffffff'
            ctx.font = '10px Inter, sans-serif'
            ctx.fillText(confText, x + 2, y + height + 12)
          }
        })
      }

      // Draw risk zones if enabled
      if (overlaySettings.showRiskZones && riskScores.length > 0) {
        const currentRisk = riskScores.find(
          (r) => Math.abs(r.timestamp - currentTime) < 2.5
        )
        if (currentRisk && currentRisk.score > 0.5) {
          // Draw risk indicator
          const color = getRiskColor(currentRisk.score)
          ctx.strokeStyle = color
          ctx.lineWidth = 4
          ctx.setLineDash([10, 5])
          ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
          ctx.setLineDash([])

          // Risk badge
          ctx.fillStyle = color
          ctx.fillRect(canvas.width - 100, 10, 90, 28)
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 12px Inter, sans-serif'
          ctx.fillText(
            `Risk: ${Math.round(currentRisk.score * 100)}%`,
            canvas.width - 95,
            28
          )
        }
      }
    }, [currentTime, tracks, riskScores, overlaySettings, heatmapData])

    // Animation loop for overlays
    useEffect(() => {
      let animationId: number

      const animate = () => {
        drawOverlays()
        animationId = requestAnimationFrame(animate)
      }

      if (isLoaded) {
        animate()
      }

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId)
        }
      }
    }, [isLoaded, drawOverlays])

    // Handle video events
    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime
        setCurrentTime(time)
        onTimeUpdate?.(time)
      }
    }, [onTimeUpdate])

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        const dur = videoRef.current.duration
        setDuration(dur)
        setIsLoaded(true)
        onDurationChange?.(dur)
      }
    }, [onDurationChange])

    const handlePlay = useCallback(() => setIsPlaying(true), [])
    const handlePause = useCallback(() => setIsPlaying(false), [])

    const togglePlay = useCallback(() => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause()
        } else {
          videoRef.current.play()
        }
      }
    }, [isPlaying])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      if (videoRef.current) {
        videoRef.current.currentTime = time
        setCurrentTime(time)
      }
    }, [])

    const skipTime = useCallback((seconds: number) => {
      if (videoRef.current) {
        const newTime = Math.max(
          0,
          Math.min(videoRef.current.currentTime + seconds, duration)
        )
        videoRef.current.currentTime = newTime
        setCurrentTime(newTime)
      }
    }, [duration])

    return (
      <div className={cn('relative bg-black rounded-xl overflow-hidden', className)}>
        <div ref={containerRef} className="relative aspect-video">
          {/* Video Element */}
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            playsInline
          />

          {/* Canvas Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
          />

          {/* Video not loaded placeholder */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-card flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-text-muted animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-text-muted">Loading video...</p>
              </div>
            </div>
          )}

          {/* Center play button (when paused) */}
          {isLoaded && !isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
            >
              <div className="w-20 h-20 rounded-full bg-accent-blue/90 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-accent-blue
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Skip Back */}
              <button
                onClick={() => skipTime(-10)}
                className="p-2 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:text-accent-blue transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => skipTime(10)}
                className="p-2 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>

              {/* Time Display */}
              <span className="text-white/90 text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right side controls could go here (fullscreen, volume, etc.) */}
          </div>
        </div>
      </div>
    )
  }
)

VideoPlayerWithOverlay.displayName = 'VideoPlayerWithOverlay'
