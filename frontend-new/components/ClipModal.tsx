'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatTime } from '@/lib/utils'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/types'
import type { VideoEvent } from '@/lib/types'

interface ClipModalProps {
  isOpen: boolean
  onClose: () => void
  event: VideoEvent | null
  videoSrc?: string
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function ClipModal({
  isOpen,
  onClose,
  event,
  videoSrc,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: ClipModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auto-play when modal opens
  useEffect(() => {
    if (isOpen && videoRef.current && event) {
      // Seek to event timestamp (with 2 second buffer before)
      const startTime = Math.max(0, event.timestamp - 2)
      videoRef.current.currentTime = startTime
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's ok
      })
    }
  }, [isOpen, event])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrevious) {
        onPrevious?.()
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext?.()
      }
    },
    [hasPrevious, hasNext, onPrevious, onNext]
  )

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!event) return null

  const eventColor = EVENT_COLORS[event.type]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="">
      <div className="space-y-4">
        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              preload="metadata"
              controls
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary">
              <p className="text-text-muted text-sm">Video source unavailable.</p>
            </div>
          )}

          {/* Event badge overlay */}
          <div className="absolute top-4 left-4">
            <div
              className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2"
              style={{
                backgroundColor: `${eventColor}20`,
                borderColor: `${eventColor}60`,
                color: eventColor,
                borderWidth: 1,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: eventColor }}
              />
              {EVENT_LABELS[event.type]}
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {EVENT_LABELS[event.type]}
            </h3>
            <p className="text-sm text-text-secondary">
              {formatTime(event.timestamp)}
              {event.endTimestamp && ` - ${formatTime(event.endTimestamp)}`}
            </p>
          </div>
          <div
            className="text-sm font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: `${eventColor}20`,
              color: eventColor,
            }}
          >
            {Math.round(event.confidence * 100)}% confidence
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-text-secondary">{event.description}</p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-2">
          {event.zone && (
            <span className="text-xs px-2 py-1 bg-bg-secondary rounded text-text-secondary">
              Zone: {event.zone.replace(/_/g, ' ')}
            </span>
          )}
          {event.players && event.players.length > 0 && (
            <span className="text-xs px-2 py-1 bg-bg-secondary rounded text-text-secondary">
              Players: {event.players.join(', ')}
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </Button>

          <span className="text-xs text-text-muted">
            Use arrow keys to navigate
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!hasNext}
          >
            Next
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
