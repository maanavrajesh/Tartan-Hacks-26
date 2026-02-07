'use client'

import {
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'

export interface VideoPlayerHandle {
  seekTo: (time: number) => void
  play: () => void
  pause: () => void
  getCurrentTime: () => number
}

interface VideoPlayerProps {
  videoSrc?: string
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
  className?: string
}

export const VideoPlayerWithOverlay = forwardRef<
  VideoPlayerHandle,
  VideoPlayerProps
>(
  (
    {
      videoSrc,
      onTimeUpdate,
      onDurationChange,
      className,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isLoaded, setIsLoaded] = useState(false)

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time
          setCurrentTime(time)
        }
      },
      play: () => { videoRef.current?.play() },
      pause: () => { videoRef.current?.pause() },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    }))

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
        if (isPlaying) videoRef.current.pause()
        else videoRef.current.play()
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
        const newTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration))
        videoRef.current.currentTime = newTime
        setCurrentTime(newTime)
      }
    }, [duration])

    return (
      <div className={cn('relative bg-black rounded-xl overflow-hidden', className)}>
        <div className="relative aspect-video">
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

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-card flex items-center justify-center">
                  <svg className="w-8 h-8 text-text-muted animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-text-muted">Loading video...</p>
              </div>
            </div>
          )}

          {isLoaded && !isPlaying && (
            <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40">
              <div className="w-20 h-20 rounded-full bg-accent-blue/90 flex items-center justify-center">
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-accent-blue [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => skipTime(-10)} className="p-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>
            <button onClick={togglePlay} className="p-2 text-white hover:text-accent-blue transition-colors">
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={() => skipTime(10)} className="p-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
            <span className="text-white/90 text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    )
  }
)

VideoPlayerWithOverlay.displayName = 'VideoPlayerWithOverlay'
