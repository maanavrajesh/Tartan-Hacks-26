'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { videoApi } from '@/hooks/useVideo'
import { Button } from '@/components/ui/Button'
import { PlayerSelector } from '@/components/report/PlayerSelector'
import { StatsGrid } from '@/components/report/StatsGrid'
import { InsightsPanel } from '@/components/report/InsightsPanel'
import { KeyMoments } from '@/components/report/KeyMoments'
import { FeedbackList } from '@/components/report/FeedbackList'
import type { PlayerFeedback } from '@/lib/types'

export default function ReportPage() {
  const params = useParams()
  const videoId = params.id as string

  const [players, setPlayers] = useState<PlayerFeedback[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await videoApi.getFeedback(videoId)
        if (cancelled) return
        setPlayers(data)
        if (data.length > 0) {
          setSelectedId(data[0].player_id)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load feedback')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [videoId])

  const selected = players.find((p) => p.player_id === selectedId) ?? null

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-text-primary font-semibold">Player Report</h1>
              <p className="text-xs text-text-muted">AI-powered performance analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/viewer/${videoId}`}>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch Video
              </Button>
            </Link>
            <a href={videoApi.getDownloadUrl(videoId)}>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-text-secondary animate-pulse">Loading player feedback...</div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-event-shot/10 border border-event-shot/30">
              <svg className="w-5 h-5 text-event-shot flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-event-shot">{error}</p>
            </div>
            <Link href={`/viewer/${videoId}`}>
              <Button variant="secondary" size="sm">View Video Instead</Button>
            </Link>
          </div>
        )}

        {!loading && !error && players.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-text-muted">No player data available for this video.</p>
            <Link href={`/viewer/${videoId}`}>
              <Button variant="secondary" size="sm">View Video</Button>
            </Link>
          </div>
        )}

        {!loading && !error && selected && (
          <div className="space-y-6">
            {/* Player Selector */}
            <PlayerSelector
              players={players}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Stats + Key Moments + Coaching Tips */}
              <div className="space-y-6">
                <StatsGrid player={selected} />
                <KeyMoments player={selected} videoId={videoId} />
                <FeedbackList feedback={selected.feedback} />
              </div>

              {/* Right: LLM Insights */}
              <div>
                <InsightsPanel llmFeedback={selected.llm_feedback} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
