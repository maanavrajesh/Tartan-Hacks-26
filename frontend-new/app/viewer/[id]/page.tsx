'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayerWithOverlay, type VideoPlayerHandle } from '@/components/video'
import { EventTimeline, RiskStrip } from '@/components/timeline'
import { InsightPanel } from '@/components/insights'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useVideo, videoApi } from '@/hooks/useVideo'
import { cn } from '@/lib/utils'
import type { VideoEvent } from '@/lib/types'

export default function ViewerPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string

  const videoRef = useRef<VideoPlayerHandle>(null)
  const [timelineFilter, setTimelineFilter] = useState<'top' | 'all' | 'risk' | 'attack'>('top')
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)

  const {
    artifacts,
    isLoading,
    overlaySettings,
    setOverlaySettings,
    selectedEvent,
    selectEvent,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
  } = useVideo({ videoId })

  useEffect(() => {
    // Use processed video from Flask backend, fall back to local upload
    const backendUrl = videoApi.getVideoUrl(videoId)
    setVideoSrc(backendUrl)
  }, [videoId])

  // Handle event click - seek video and select event
  const handleEventClick = useCallback(
    (event: VideoEvent) => {
      selectEvent(event)
      videoRef.current?.seekTo(event.timestamp)
      videoRef.current?.pause()
    },
    [selectEvent]
  )

  // Handle risk strip time click
  const handleTimeClick = useCallback((time: number) => {
    videoRef.current?.seekTo(time)
  }, [])

  // Handle view clip
  const handleViewClip = useCallback((clipId: string) => {
    // In production, this would open a clip modal
    console.log('View clip:', clipId)
  }, [])

  // Toggle overlay settings
  const toggleOverlay = useCallback(
    (key: keyof typeof overlaySettings) => {
      setOverlaySettings({ [key]: !overlaySettings[key] })
    },
    [overlaySettings, setOverlaySettings]
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="max-w-[1800px] mx-auto px-4 py-6 space-y-6 animate-pulse">
          <div className="h-10 w-64 rounded-lg bg-bg-secondary" />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
            <div className="space-y-6">
              <div className="aspect-video rounded-xl bg-bg-secondary" />
              <div className="h-20 rounded-xl bg-bg-secondary" />
              <div className="h-28 rounded-xl bg-bg-secondary" />
            </div>
            <div className="space-y-4">
              <div className="h-24 rounded-xl bg-bg-secondary" />
              <div className="h-24 rounded-xl bg-bg-secondary" />
              <div className="h-24 rounded-xl bg-bg-secondary" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-text-primary font-semibold">
                {artifacts.meta.filename}
              </h1>
              <p className="text-xs text-text-muted">
                {artifacts.meta.sport.charAt(0).toUpperCase() +
                  artifacts.meta.sport.slice(1)}{' '}
                Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/report/${videoId}`)}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View Report
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex">
        {/* Left Column - Video Player */}
          <div className="flex-1 min-w-0 p-4 space-y-4">
            {/* Video Player */}
            <VideoPlayerWithOverlay
              videoSrc={videoSrc}
              ref={videoRef}
              tracks={artifacts.tracks}
              riskScores={artifacts.predictions.riskScores}
              overlaySettings={overlaySettings}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
          />

          {/* Overlay Toggles */}
          <Card padding="sm">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-text-secondary">Overlays:</span>

              <button
                onClick={() => toggleOverlay('showPlayers')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  overlaySettings.showPlayers
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    overlaySettings.showPlayers
                      ? 'bg-accent-blue'
                      : 'bg-text-muted'
                  )}
                />
                Players
              </button>

              <button
                onClick={() => toggleOverlay('showBall')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  overlaySettings.showBall
                    ? 'bg-event-press/20 text-event-press border border-event-press/40'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    overlaySettings.showBall
                      ? 'bg-event-press'
                      : 'bg-text-muted'
                  )}
                />
                Ball
              </button>

              <button
                onClick={() => toggleOverlay('showTrackIds')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  overlaySettings.showTrackIds
                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/40'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    overlaySettings.showTrackIds
                      ? 'bg-accent-purple'
                      : 'bg-text-muted'
                  )}
                />
                Track IDs
              </button>

              <button
                onClick={() => toggleOverlay('showHeatmap')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  overlaySettings.showHeatmap
                    ? 'bg-event-attack/20 text-event-attack border border-event-attack/40'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    overlaySettings.showHeatmap
                      ? 'bg-event-attack'
                      : 'bg-text-muted'
                  )}
                />
                Heatmap
              </button>

              <button
                onClick={() => toggleOverlay('showRiskZones')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  overlaySettings.showRiskZones
                    ? 'bg-event-shot/20 text-event-shot border border-event-shot/40'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    overlaySettings.showRiskZones
                      ? 'bg-event-shot'
                      : 'bg-text-muted'
                  )}
                />
                Risk Zones
              </button>
            </div>
          </Card>

          {/* Risk Strip */}
          <Card padding="md">
            <RiskStrip
              riskScores={artifacts.predictions.riskScores}
              events={artifacts.events}
              duration={duration || artifacts.meta.duration}
              currentTime={currentTime}
              onTimeClick={handleTimeClick}
            />
          </Card>

          {/* Event Timeline */}
          <Card padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-medium text-text-primary">Event Timeline</h3>
                <p className="text-xs text-text-muted">
                  Long matches auto-cluster for faster review.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { id: 'top', label: 'Top events' },
                  { id: 'all', label: 'Show all' },
                  { id: 'risk', label: 'Risk moments' },
                  { id: 'attack', label: 'Attacks only' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() =>
                      setTimelineFilter(option.id as typeof timelineFilter)
                    }
                    className={`px-3 py-1 rounded-full border transition-colors ${
                      timelineFilter === option.id
                        ? 'bg-accent-blue text-white border-accent-blue'
                        : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-card-hover'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <EventTimeline
              events={artifacts.events}
              duration={duration || artifacts.meta.duration}
              currentTime={currentTime}
              selectedEventId={selectedEvent?.id}
              onEventClick={handleEventClick}
              filterMode={timelineFilter}
              riskMoments={artifacts.predictions.topRiskMoments}
            />
          </Card>
        </div>

        {/* Right Column - Insight Panel */}
        <div className="w-80 xl:w-96 border-l border-border bg-bg-secondary/30 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-60px)]">
          <InsightPanel
            selectedEvent={selectedEvent}
            events={artifacts.events}
            insights={artifacts.insights}
            metrics={artifacts.metrics}
            onViewClip={handleViewClip}
            onJumpToEvent={handleEventClick}
          />
        </div>
      </div>
    </div>
  )
}
