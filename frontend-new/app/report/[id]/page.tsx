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
import type { PlayerFeedback } from '@/lib/types'

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
  const [players, setPlayers] = useState<PlayerFeedback[]>([])
  const [playerError, setPlayerError] = useState<string | null>(null)

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

  useEffect(() => {
    let cancelled = false
    async function loadPlayers() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/feedback/${videoId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load player feedback')
        }
        const data = await res.json()
        if (!cancelled) {
          setPlayers(data)
        }
      } catch (err) {
        if (!cancelled) {
          setPlayerError(err instanceof Error ? err.message : 'Failed to load player feedback')
        }
      }
    }
    loadPlayers()
    return () => { cancelled = true }
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
                Vision XI Match Report
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

        {/* Player Dashboards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Player Dashboards
              </h2>
              <p className="text-sm text-text-secondary">
                Click a player to open individual analytics.
              </p>
            </div>
            <Link href={`/player/${videoId}`}>
              <Button variant="secondary" size="sm">View All Players</Button>
            </Link>
          </div>
          <Card padding="lg">
            {playerError && (
              <p className="text-sm text-event-shot">{playerError}</p>
            )}
            {!playerError && players.length === 0 && (
              <p className="text-sm text-text-muted">
                Player analytics will appear once feedback is ready.
              </p>
            )}
            {!playerError && players.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {players.map((player) => (
                  <Link
                    key={player.player_id}
                    href={`/player/${videoId}?player=${player.player_id}`}
                    className="p-3 rounded-lg bg-bg-secondary hover:bg-bg-card-hover transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary">
                      Player #{player.player_id}
                    </p>
                    <p className="text-xs text-text-muted">Team {player.team ?? 'N/A'}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Team Analytics */}
        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Team Analytics
          </h2>
          <Card padding="lg">
            {players.length === 0 ? (
              <p className="text-sm text-text-muted">
                Team analytics will appear once player feedback is ready.
              </p>
            ) : (
              <TeamAnalytics players={players} />
            )}
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-text-muted">
          <p>
            Vision XI | Match Intelligence
          </p>
        </div>
      </footer>
    </div>
  )
}

function TeamAnalytics({ players }: { players: PlayerFeedback[] }) {
  const teams = players.reduce(
    (acc, p) => {
      const key = p.team === 2 ? 'team2' : 'team1'
      acc[key].push(p)
      return acc
    },
    { team1: [] as PlayerFeedback[], team2: [] as PlayerFeedback[] }
  )

  const buildStats = (items: PlayerFeedback[]) => {
    if (items.length === 0) return null
    const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length
    return [
      { label: 'Avg Speed', value: avg(items.map((p) => p.avg_speed_kmh)), unit: 'km/h', max: 25 },
      { label: 'Max Speed', value: Math.max(...items.map((p) => p.max_speed_kmh)), unit: 'km/h', max: 35 },
      { label: 'Distance', value: avg(items.map((p) => p.distance_m)), unit: 'm', max: 1200 },
      { label: 'Ball Control', value: avg(items.map((p) => p.ball_control_pct)), unit: '%', max: 100 },
      { label: 'Movement', value: avg(items.map((p) => p.movement_control_pct)), unit: '%', max: 100 },
      { label: 'Pressure', value: avg(items.map((p) => p.pressure_control_pct)), unit: '%', max: 100 },
    ]
  }

  const team1Stats = buildStats(teams.team1)
  const team2Stats = buildStats(teams.team2)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TeamCard title="Team One" stats={team1Stats} />
      <TeamCard title="Team Two" stats={team2Stats} />
    </div>
  )
}

function TeamCard({
  title,
  stats,
}: {
  title: string
  stats: Array<{ label: string; value: number; unit: string; max: number }> | null
}) {
  if (!stats) {
    return (
      <div className="p-4 rounded-lg bg-bg-secondary">
        <p className="text-sm text-text-muted">{title} analytics not available.</p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg bg-bg-secondary space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {stats.map((stat) => {
        const pct = Math.min(100, (stat.value / stat.max) * 100)
        return (
          <div key={stat.label}>
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>{stat.label}</span>
              <span>{stat.value.toFixed(1)} {stat.unit}</span>
            </div>
            <div className="h-2 rounded-full bg-bg-card overflow-hidden">
              <div className="h-full bg-accent-blue" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
