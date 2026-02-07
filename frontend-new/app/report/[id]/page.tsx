'use client'

import { useCallback, useMemo, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayerWithOverlay } from '@/components/video'
import { MetricsGrid } from '@/components/metrics'
import { InsightCard, TopMoments } from '@/components/insights'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useVideo, videoApi } from '@/hooks/useVideo'
import { formatDuration } from '@/lib/utils'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string

  const { artifacts, isLoading } = useVideo({ videoId })

  const duration = artifacts.meta.duration
  const isLongVideo = duration >= 10 * 60

  const metricsWithContext = useMemo(() => {
    if (!isLongVideo) return artifacts.metrics
    return artifacts.metrics.map((metric) => {
      if (metric.context) return metric
      const name = metric.name.toLowerCase()
      let context = 'Per 5 minutes'
      if (name.includes('possession')) {
        context = 'Per possession proxy'
      } else if (name.includes('rally')) {
        context = 'Per rally'
      }
      return { ...metric, context }
    })
  }, [artifacts.metrics, isLongVideo])

  const curatedMoments = useMemo(() => {
    return artifacts.predictions.topRiskMoments.slice(0, 8)
  }, [artifacts.predictions.topRiskMoments])

  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)

  const overlaySettings = useMemo(
    () => ({
      showPlayers: false,
      showBall: false,
      showTrackIds: false,
      showHeatmap: false,
      showRiskZones: false,
    }),
    []
  )

  useEffect(() => {
    setVideoSrc(videoApi.getVideoUrl(videoId))
  }, [videoId])

  const handleViewEvidence = useCallback(
    (eventIds: string[]) => {
      // Navigate to viewer with the first event selected
      const firstEventId = eventIds[0]
      const event = artifacts.events.find((e) => e.id === firstEventId)
      if (event) {
        router.push(`/viewer/${videoId}?event=${firstEventId}&t=${event.timestamp}`)
      } else {
        router.push(`/viewer/${videoId}`)
      }
    },
    [artifacts.events, router, videoId]
  )

  const handleMomentClick = useCallback(
    (timestamp: number) => {
      router.push(`/viewer/${videoId}?t=${timestamp}`)
    },
    [router, videoId]
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-pulse">
          <div className="h-10 w-72 rounded-lg bg-bg-secondary" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-bg-secondary" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-bg-secondary" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 rounded-xl bg-bg-secondary" />
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-bg-secondary" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/viewer/${videoId}`}
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
                Match Analysis Report
              </h1>
              <p className="text-xs text-text-muted">
                {artifacts.meta.filename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/viewer/${videoId}`)}
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Back to Viewer
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Video Review */}
        <Card padding="lg">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Video Review
              </h2>
              <p className="text-sm text-text-secondary">
                Scrub through the match to cross-check events.
              </p>
            </div>
            <VideoPlayerWithOverlay videoSrc={videoSrc} overlaySettings={overlaySettings} />
          </div>
        </Card>

        {/* Summary Stats */}
        <Card padding="lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">
                {formatDuration(artifacts.meta.duration)}
              </p>
              <p className="text-sm text-text-secondary">Duration</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">
                {artifacts.events.length}
              </p>
              <p className="text-sm text-text-secondary">Events Detected</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">
                {artifacts.predictions.topRiskMoments.length}
              </p>
              <p className="text-sm text-text-secondary">High-Impact Moments</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">
                {artifacts.insights.length}
              </p>
              <p className="text-sm text-text-secondary">Coaching Insights</p>
            </div>
          </div>
        </Card>

        {/* Section: Metrics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Tactical Metrics
              </h2>
              <p className="text-sm text-text-secondary">
                Evidence-linked metrics for soccer analysis
              </p>
            </div>
          </div>
          <MetricsGrid
            metrics={metricsWithContext}
            onViewEvidence={handleViewEvidence}
          />
        </section>

        {/* Section: Top Moments & Insights (2-column) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Moments */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              Top Moments
            </h2>
            <TopMoments
              moments={curatedMoments}
              onMomentClick={handleMomentClick}
            />
          </div>

          {/* Coaching Insights */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              Coaching Insights
            </h2>
            <div className="space-y-4">
              {artifacts.insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  events={artifacts.events}
                  onViewEvidence={handleViewEvidence}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Section: Event Summary */}
        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Event Summary
          </h2>
          <Card padding="lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {/* Count events by type */}
              {Object.entries(
                artifacts.events.reduce(
                  (acc, event) => {
                    acc[event.type] = (acc[event.type] || 0) + 1
                    return acc
                  },
                  {} as Record<string, number>
                )
              ).map(([type, count]) => (
                <div
                  key={type}
                  className="p-4 bg-bg-secondary rounded-lg text-center"
                >
                  <p className="text-2xl font-bold text-text-primary">{count}</p>
                  <p className="text-xs text-text-secondary capitalize">
                    {type.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Next steps */}
        <Card padding="lg" className="bg-gradient-to-r from-accent-blue/10 to-event-attack/10 border-accent-blue/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-accent-blue"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-2">
                Next Tactical Focus
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Use this report to review pressing triggers, compactness shifts,
                and transition timing. Tag additional clips to refine the
                tactical recommendations for your next match plan.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-event-attack" />
                  <span className="text-text-secondary">Pressing intensity</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-accent-blue" />
                  <span className="text-text-secondary">Shape stability</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-event-press" />
                  <span className="text-text-secondary">Transition speed</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-text-muted">
          <p>
            Soccer Film Intelligence | Built for NexHacks 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
