'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'
import type { VideoEvent, EventType } from '@/lib/types'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/types'

type TimelineFilter = 'top' | 'all' | 'risk' | 'attack'

interface EventTimelineProps {
  events: VideoEvent[]
  duration: number
  currentTime: number
  selectedEventId?: string | null
  onEventClick: (event: VideoEvent) => void
  filterMode?: TimelineFilter
  riskMoments?: Array<{ timestamp: number }>
  className?: string
}

// Event icon components
function EventIcon({ type }: { type: EventType }) {
  const icons: Record<EventType, React.ReactNode> = {
    shot_attempt: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    turnover: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    press_moment: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    attack_entry: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    ),
    dead_zone: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
  }

  return icons[type] || null
}

export function EventTimeline({
  events,
  duration,
  currentTime,
  selectedEventId,
  onEventClick,
  filterMode = 'top',
  riskMoments = [],
  className,
}: EventTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [hoveredEvent, setHoveredEvent] = useState<VideoEvent | null>(null)
  const [zoomLevel, setZoomLevel] = useState<'overview' | 'focused'>('overview')
  const [focusCenter, setFocusCenter] = useState(0)
  const focusWindow = 240

  // Filter events based on confidence (show top events by default)
  const filteredEvents = useMemo(() => {
    let filtered = events

    if (filterMode === 'attack') {
      filtered = filtered.filter((e) => e.type === 'attack_entry')
    } else if (filterMode === 'risk' && riskMoments.length > 0) {
      filtered = filtered.filter((event) =>
        riskMoments.some(
          (moment) => Math.abs(moment.timestamp - event.timestamp) <= 6
        )
      )
    }

    // If not showing all, only show high confidence events
    if (filterMode === 'top') {
      filtered = filtered.filter((e) => e.confidence >= 0.7)
    }

    return filtered.sort((a, b) => a.timestamp - b.timestamp)
  }, [events, filterMode, riskMoments])

  const longVideo = duration >= 10 * 60

  const windowDuration =
    zoomLevel === 'focused' ? Math.min(focusWindow, duration || focusWindow) : duration
  const windowStart = useMemo(() => {
    if (zoomLevel !== 'focused' || duration <= focusWindow) return 0
    const clamped = Math.min(
      Math.max(focusCenter - focusWindow / 2, 0),
      Math.max(duration - focusWindow, 0)
    )
    return clamped
  }, [zoomLevel, duration, focusCenter])
  const windowEnd = windowStart + (windowDuration || duration)

  const visibleEvents = useMemo(() => {
    if (zoomLevel !== 'focused') return filteredEvents
    return filteredEvents.filter(
      (event) => event.timestamp >= windowStart && event.timestamp <= windowEnd
    )
  }, [filteredEvents, zoomLevel, windowStart, windowEnd])

  const timelineItems = useMemo(() => {
    if (!longVideo || zoomLevel === 'focused') {
      return visibleEvents.map((event) => ({ type: 'event' as const, event }))
    }

    const binSize = duration >= 30 * 60 ? 90 : duration >= 20 * 60 ? 60 : 30
    const bins = new Map<number, VideoEvent[]>()

    visibleEvents.forEach((event) => {
      const index = Math.floor(event.timestamp / binSize)
      if (!bins.has(index)) {
        bins.set(index, [])
      }
      bins.get(index)!.push(event)
    })

    return Array.from(bins.entries())
      .map(([index, binEvents]) => {
        if (binEvents.length === 1) {
          return { type: 'event' as const, event: binEvents[0] }
        }
        const start = index * binSize
        const end = start + binSize
        return { type: 'cluster' as const, start, end, events: binEvents }
      })
      .sort((a, b) => {
        const timeA = a.type === 'event' ? a.event.timestamp : (a.start + a.end) / 2
        const timeB = b.type === 'event' ? b.event.timestamp : (b.start + b.end) / 2
        return timeA - timeB
      })
  }, [longVideo, zoomLevel, visibleEvents, duration])

  // Scroll to keep current time indicator visible
  useEffect(() => {
    if (scrollContainerRef.current && duration > 0 && zoomLevel === 'overview') {
      const scrollPosition = (currentTime / duration) * scrollContainerRef.current.scrollWidth
      const containerWidth = scrollContainerRef.current.clientWidth
      const targetScroll = scrollPosition - containerWidth / 2

      scrollContainerRef.current.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth',
      })
    }
  }, [currentTime, duration, zoomLevel])

  const getEventPosition = useCallback(
    (timestamp: number) => {
      const range = windowDuration || duration
      if (range === 0) return 0
      return ((timestamp - windowStart) / range) * 100
    },
    [duration, windowDuration, windowStart]
  )

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (duration === 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / rect.width
      const cursorTime = windowStart + ratio * (windowDuration || duration)

      if (event.deltaY < 0) {
        setZoomLevel('focused')
        setFocusCenter(cursorTime)
      } else if (event.deltaY > 0) {
        setZoomLevel('overview')
      }
    },
    [duration, windowStart, windowDuration]
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (zoomLevel !== 'focused' || duration <= focusWindow) return
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / rect.width
      setFocusCenter(windowStart + ratio * (windowDuration || duration))
    },
    [zoomLevel, duration, windowStart, windowDuration]
  )

  useEffect(() => {
    if (zoomLevel === 'focused') {
      setFocusCenter(currentTime)
    }
  }, [zoomLevel, currentTime])

  const markerInterval = useMemo(() => {
    const span = windowDuration || duration
    if (span <= 120) return 10
    if (span <= 300) return 20
    if (span <= 900) return 60
    return 120
  }, [windowDuration, duration])

  const markers = useMemo(() => {
    if (duration === 0) return []
    const start = windowStart
    const end = zoomLevel === 'focused' ? windowEnd : duration
    const first = Math.ceil(start / markerInterval) * markerInterval
    const result: number[] = []
    for (let t = first; t <= end; t += markerInterval) {
      result.push(t)
    }
    return result
  }, [duration, windowStart, windowEnd, zoomLevel, markerInterval])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Zoom hint */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          Zoom: {zoomLevel === 'overview' ? 'Overview' : 'Focused window'}
        </span>
        <span>Scroll to zoom · Move cursor to shift focus</span>
      </div>

      {/* Timeline visualization */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        className={cn(
          'relative h-24 bg-bg-secondary rounded-lg hide-scrollbar',
          zoomLevel === 'overview' ? 'overflow-x-auto' : 'overflow-hidden'
        )}
      >
        {/* Timeline track */}
        <div
          className="relative h-full"
          style={{
            minWidth:
              zoomLevel === 'overview' ? Math.max(600, duration * 10) : '100%',
          }}
        >
          {/* Time markers */}
          <div className="absolute top-0 left-0 right-0 h-6 border-b border-border flex items-end">
            {markers.map((marker) => (
              <div
                key={marker}
                className="absolute text-xs text-text-muted"
                style={{ left: `${getEventPosition(marker)}%` }}
              >
                <div className="h-2 w-px bg-border mb-1" />
                <span className="ml-1">{formatTime(marker)}</span>
              </div>
            ))}
          </div>

          {/* Current time indicator */}
          {currentTime >= windowStart && currentTime <= windowEnd && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent-blue z-20 transition-all duration-100"
              style={{ left: `${getEventPosition(currentTime)}%` }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-accent-blue rounded-full" />
            </div>
          )}

          {/* Event markers */}
          <div className="absolute top-8 left-0 right-0 bottom-2">
            {timelineItems.map((item, index) => {
              if (item.type === 'cluster') {
                const midpoint = (item.start + item.end) / 2
                return (
                  <button
                    key={`cluster-${item.start}-${index}`}
                    className="absolute -translate-x-1/2 flex items-center gap-2 rounded-full bg-bg-card px-2 py-1 text-xs text-text-secondary border border-border hover:bg-bg-card-hover"
                    style={{ left: `${getEventPosition(midpoint)}%` }}
                    onClick={() => {
                      setZoomLevel('focused')
                      setFocusCenter(midpoint)
                    }}
                  >
                    <span className="text-text-primary font-medium">
                      {item.events.length}
                    </span>
                    <span>events</span>
                  </button>
                )
              }

              const event = item.event
              const isSelected = event.id === selectedEventId
              const isHovered = hoveredEvent?.id === event.id
              const color = EVENT_COLORS[event.type]

              return (
                <div
                  key={event.id}
                  className="absolute group cursor-pointer"
                  style={{
                    left: `${getEventPosition(event.timestamp)}%`,
                    transform: 'translateX(-50%)',
                  }}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  onClick={() => onEventClick(event)}
                >
                  {/* Event chip */}
                  <div
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all',
                      isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary'
                    )}
                    style={{
                      backgroundColor: `${color}20`,
                      borderColor: `${color}60`,
                      color: color,
                      borderWidth: 1,
                      transform: isHovered || isSelected ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <EventIcon type={event.type} />
                    <span className="hidden sm:inline">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>

                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
                      <div className="bg-bg-card border border-border rounded-lg p-2 shadow-lg min-w-[160px]">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-text-primary text-sm">
                            {EVENT_LABELS[event.type]}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mb-1">
                          {formatTime(event.timestamp)}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-text-muted">Confidence:</span>
                          <span
                            className="text-xs font-medium"
                            style={{ color }}
                          >
                            {Math.round(event.confidence * 100)}%
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event count */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          Showing {visibleEvents.length} of {events.length} events
        </span>
        {filterMode === 'top' && (
          <span className="text-accent-blue">High confidence only</span>
        )}
      </div>
    </div>
  )
}
