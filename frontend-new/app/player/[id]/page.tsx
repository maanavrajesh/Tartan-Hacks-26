'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PlayerFeedback } from '@/lib/types'

type StatBar = {
  label: string
  value: number
  unit: string
  max: number
}

export default function PlayerDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const videoId = params.id as string
  const playerFromQuery = searchParams.get('player')

  const [players, setPlayers] = useState<PlayerFeedback[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(
    playerFromQuery ? Number(playerFromQuery) : null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/feedback/${videoId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load player feedback')
        }
        const data = await res.json()
        if (!cancelled) {
          setPlayers(data)
          if (data.length > 0) {
            setSelectedId((prev) => prev ?? data[0].player_id)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load player feedback')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [videoId])

  const selected = players.find((p) => p.player_id === selectedId) ?? null

  const stats = useMemo<StatBar[]>(() => {
    if (!selected) return []
    return [
      { label: 'Avg Speed', value: selected.avg_speed_kmh, unit: 'km/h', max: 25 },
      { label: 'Max Speed', value: selected.max_speed_kmh, unit: 'km/h', max: 35 },
      { label: 'Distance', value: selected.distance_m, unit: 'm', max: 1200 },
      { label: 'Ball Control', value: selected.ball_control_pct, unit: '%', max: 100 },
      { label: 'Movement', value: selected.movement_control_pct, unit: '%', max: 100 },
      { label: 'Pressure', value: selected.pressure_control_pct, unit: '%', max: 100 },
    ]
  }, [selected])

  const keyMoments = useMemo(() => {
    if (!selected) return []
    const moments: Array<{ label: string; time: number | null }> = []
    if (selected.top_speed_time_s !== null) {
      moments.push({ label: 'Top speed burst', time: selected.top_speed_time_s })
    }
    selected.possession_windows_s.slice(0, 3).forEach((window, idx) => {
      moments.push({ label: `Possession window ${idx + 1}`, time: window.t0 })
    })
    return moments
  }, [selected])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Vision XI Player Dashboard</h1>
            <p className="text-xs text-text-muted">Video {videoId}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/viewer/${videoId}`}>
              <Button variant="secondary" size="sm">Back to Viewer</Button>
            </Link>
            <Link href={`/report/${videoId}`}>
              <Button variant="secondary" size="sm">Back to Report</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        {loading && (
          <div className="text-text-secondary animate-pulse">Loading player dashboard...</div>
        )}

        {error && (
          <Card padding="md">
            <p className="text-sm text-event-shot">{error}</p>
          </Card>
        )}

        {!loading && !error && players.length === 0 && (
          <Card padding="md">
            <p className="text-sm text-text-muted">No player feedback available yet.</p>
          </Card>
        )}

        {!loading && !error && players.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
            <Card padding="md">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Players</h2>
              <div className="space-y-2">
                {players.map((player) => (
                  <button
                    key={player.player_id}
                    onClick={() => setSelectedId(player.player_id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      player.player_id === selectedId
                        ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40'
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-card-hover'
                    }`}
                  >
                    <span>Player #{player.player_id}</span>
                    <span className="text-xs text-text-muted">
                      Team {player.team ?? 'N/A'}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <div className="space-y-6">
              {selected && (
                <>
                  <Card padding="md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Player #{selected.player_id}
                        </h2>
                        <p className="text-xs text-text-muted">
                          Team {selected.team ?? 'N/A'} • Role {selected.position_role ?? 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">Presence</p>
                        <p className="text-sm font-medium">{selected.presence_total_s}s</p>
                      </div>
                    </div>
                  </Card>

                  <Card padding="md">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Performance Graphs</h3>
                    <div className="space-y-3">
                      {stats.map((stat) => {
                        const pct = Math.min(100, (stat.value / stat.max) * 100)
                        return (
                          <div key={stat.label}>
                            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                              <span>{stat.label}</span>
                              <span>{stat.value.toFixed(1)} {stat.unit}</span>
                            </div>
                            <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-accent-blue"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  {selected.feedback?.length > 0 && (
                    <Card padding="md">
                      <h3 className="text-sm font-semibold text-text-primary mb-3">Coaching Notes</h3>
                      <ul className="space-y-2 text-sm text-text-secondary">
                        {selected.feedback.map((tip, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-accent-blue">-</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {keyMoments.length > 0 && (
                    <Card padding="md">
                      <h3 className="text-sm font-semibold text-text-primary mb-3">Key Moments</h3>
                      <div className="space-y-2">
                        {keyMoments.map((moment, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">{moment.label}</span>
                            {moment.time !== null ? (
                              <Link
                                href={`/viewer/${videoId}?t=${moment.time}`}
                                className="text-accent-blue hover:underline text-xs"
                              >
                                {moment.time.toFixed(2)}s
                              </Link>
                            ) : (
                              <span className="text-xs text-text-muted">N/A</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
