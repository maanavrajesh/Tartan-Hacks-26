'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Insight, VideoEvent } from '@/lib/types'

interface InsightCardProps {
  insight: Insight
  events?: VideoEvent[]
  onViewEvidence?: (eventIds: string[]) => void
  className?: string
}

export function InsightCard({
  insight,
  events = [],
  onViewEvidence,
  className,
}: InsightCardProps) {
  // Find the actual events for this insight
  const evidenceEvents = events.filter((e) =>
    insight.evidenceEvents.includes(e.id)
  )

  return (
    <Card padding="lg" className={cn('space-y-4', className)}>
      {/* Claim */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-accent-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium text-accent-blue uppercase tracking-wider">
            Insight
          </span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {insight.claim}
        </h3>
      </div>

      {/* Evidence */}
      {evidenceEvents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-event-press"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="text-sm font-medium text-text-secondary">
              Evidence ({evidenceEvents.length} clips)
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {evidenceEvents.slice(0, 3).map((event) => (
              <button
                key={event.id}
                onClick={() => onViewEvidence?.([event.id])}
                className="px-3 py-1.5 bg-bg-secondary rounded-lg text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary transition-colors"
              >
                {event.type.replace(/_/g, ' ')} @ {Math.floor(event.timestamp)}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Why It Matters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-accent-purple"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-text-secondary">
            Why It Matters
          </span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          {insight.whyItMatters}
        </p>
      </div>

      {/* Action / Drill */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-event-attack"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-sm font-medium text-text-secondary">
            Recommended Action
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-primary font-medium">{insight.action}</span>
          {insight.drillUrl && (
            <a
              href={insight.drillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue hover:underline text-sm"
            >
              View Drill →
            </a>
          )}
        </div>

        {/* Goal */}
        <div className="p-3 bg-bg-secondary rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <svg
              className="w-4 h-4 text-event-attack"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Goal
            </span>
          </div>
          <p className="text-sm text-text-primary">{insight.goal}</p>
        </div>
      </div>

      {/* View All Evidence Button */}
      {insight.evidenceEvents.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onViewEvidence?.(insight.evidenceEvents)}
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
          View All Evidence Clips
        </Button>
      )}
    </Card>
  )
}

// Top Moments Component
interface TopMomentsProps {
  moments: Array<{
    timestamp: number
    score: number
    eventId?: string
    description?: string
  }>
  onMomentClick?: (timestamp: number) => void
  className?: string
}

export function TopMoments({
  moments,
  onMomentClick,
  className,
}: TopMomentsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return 'bg-event-shot'
    if (score >= 0.4) return 'bg-event-press'
    return 'bg-event-attack'
  }

  return (
    <Card padding="lg" className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-event-shot"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
          />
        </svg>
        <h3 className="font-semibold text-text-primary">Top Risk Moments</h3>
      </div>

      <div className="space-y-2">
        {moments.map((moment, index) => (
          <button
            key={index}
            onClick={() => onMomentClick?.(moment.timestamp)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-secondary hover:bg-bg-card-hover transition-colors text-left group"
          >
            {/* Rank */}
            <div className="w-6 h-6 rounded-full bg-bg-card flex items-center justify-center text-xs font-bold text-text-muted">
              {index + 1}
            </div>

            {/* Risk indicator */}
            <div
              className={cn(
                'w-2 h-8 rounded-full',
                getRiskColor(moment.score)
              )}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">
                  {formatTime(moment.timestamp)}
                </span>
                <span className="text-sm font-medium text-event-shot">
                  {Math.round(moment.score * 100)}% risk
                </span>
              </div>
              {moment.description && (
                <p className="text-sm text-text-secondary truncate">
                  {moment.description}
                </p>
              )}
            </div>

            {/* Play icon */}
            <svg
              className="w-5 h-5 text-text-muted group-hover:text-accent-blue transition-colors"
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
          </button>
        ))}
      </div>
    </Card>
  )
}
