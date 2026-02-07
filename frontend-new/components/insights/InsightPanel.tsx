'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatTime, formatConfidence, getConfidenceColor } from '@/lib/utils'
import type { VideoEvent, Insight, Metric } from '@/lib/types'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/types'

interface InsightPanelProps {
  selectedEvent: VideoEvent | null
  events: VideoEvent[]
  insights: Insight[]
  metrics: Metric[]
  onViewClip?: (eventId: string) => void
  onJumpToEvent?: (event: VideoEvent) => void
  className?: string
}

export function InsightPanel({
  selectedEvent,
  events,
  insights,
  metrics,
  onViewClip,
  onJumpToEvent,
  className,
}: InsightPanelProps) {
  // Find related insight for selected event
  const relatedInsight = useMemo(() => {
    if (!selectedEvent) return null
    return insights.find((insight) =>
      insight.evidenceEvents.includes(selectedEvent.id)
    )
  }, [selectedEvent, insights])

  // Find related metrics for selected event
  const relatedMetrics = useMemo(() => {
    if (!selectedEvent) return []
    return metrics.filter((metric) =>
      metric.evidenceEvents?.includes(selectedEvent.id)
    )
  }, [selectedEvent, metrics])

  // Find nearby events
  const nearbyEvents = useMemo(() => {
    if (!selectedEvent) return []
    return events
      .filter(
        (e) =>
          e.id !== selectedEvent.id &&
          Math.abs(e.timestamp - selectedEvent.timestamp) <= 15
      )
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3)
  }, [selectedEvent, events])

  const eventColor = selectedEvent ? EVENT_COLORS[selectedEvent.type] : '#94a3b8'

  return (
    <div className={cn('p-4 space-y-4 overflow-y-auto', className)}>
      {/* AI Insights (LLM) */}
      <Card padding="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
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
            <h4 className="font-medium text-text-primary">AI Insights</h4>
          </div>

          {insights.length === 0 ? (
            <p className="text-sm text-text-muted">
              LLM insights not available yet. Ensure `OPENROUTER_API_KEY` is set on the backend.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.slice(0, 3).map((insight) => (
                <div key={insight.id} className="p-3 bg-bg-secondary rounded-lg">
                  <p className="text-sm font-medium text-text-primary">
                    {insight.claim}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {insight.whyItMatters}
                  </p>
                  <div className="mt-2 text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">Action: </span>
                    {insight.action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Event Details Card */}
      <Card padding="md" className="animate-slide-in-right">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: eventColor }}
              />
              <h3 className="font-semibold text-text-primary">
                {selectedEvent ? EVENT_LABELS[selectedEvent.type] : 'Select an Event'}
              </h3>
            </div>
            {selectedEvent && (
              <div
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded',
                  getConfidenceColor(selectedEvent.confidence)
                )}
                style={{
                  backgroundColor: `${eventColor}20`,
                  color: eventColor,
                }}
              >
                {formatConfidence(selectedEvent.confidence)} Confidence
              </div>
            )}
          </div>

          {/* Timestamp */}
          {selectedEvent && (
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-text-secondary">
                {formatTime(selectedEvent.timestamp)}
                {selectedEvent.endTimestamp &&
                  ` - ${formatTime(selectedEvent.endTimestamp)}`}
              </span>
            </div>
          )}

          {/* Description */}
          {selectedEvent?.description && (
            <p className="text-sm text-text-secondary">
              {selectedEvent.description}
            </p>
          )}

          {/* Zone & Players */}
          {selectedEvent && (
            <div className="flex flex-wrap gap-2">
              {selectedEvent.zone && (
                <span className="text-xs px-2 py-1 bg-bg-secondary rounded text-text-secondary">
                  Zone: {selectedEvent.zone.replace(/_/g, ' ')}
                </span>
              )}
              {selectedEvent.players && selectedEvent.players.length > 0 && (
                <span className="text-xs px-2 py-1 bg-bg-secondary rounded text-text-secondary">
                  Players: {selectedEvent.players.join(', ')}
                </span>
              )}
            </div>
          )}

          {/* View Clip Button */}
          {selectedEvent?.clipId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewClip?.(selectedEvent.clipId!)}
              className="w-full"
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
              View Clip
            </Button>
          )}
        </div>
      </Card>

      {/* Related Insight */}
      {relatedInsight && selectedEvent && (
        <Card padding="md" className="animate-slide-in-right" style={{ animationDelay: '50ms' }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
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
              <h4 className="font-medium text-text-primary">Coaching Insight</h4>
            </div>

            <p className="text-sm text-text-primary font-medium">
              {relatedInsight.claim}
            </p>

            <p className="text-sm text-text-secondary">
              {relatedInsight.whyItMatters}
            </p>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-text-muted mb-1">Recommended:</p>
              <a
                href={relatedInsight.drillUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-blue hover:underline"
              >
                {relatedInsight.action} →
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Related Metrics */}
      {relatedMetrics.length > 0 && (
        <Card padding="md" className="animate-slide-in-right" style={{ animationDelay: '100ms' }}>
          <div className="space-y-3">
            <h4 className="font-medium text-text-primary flex items-center gap-2">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Related Metrics
            </h4>

            <div className="space-y-2">
              {relatedMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm text-text-secondary">
                    {metric.name}
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {metric.value} {metric.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Nearby Events */}
      {nearbyEvents.length > 0 && (
        <Card padding="md" className="animate-slide-in-right" style={{ animationDelay: '150ms' }}>
          <div className="space-y-3">
            <h4 className="font-medium text-text-primary">Nearby Events</h4>

            <div className="space-y-2">
              {nearbyEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onJumpToEvent?.(event)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-bg-card-hover transition-colors text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: EVENT_COLORS[event.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {EVENT_LABELS[event.type]}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatTime(event.timestamp)}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-text-muted"
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
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
