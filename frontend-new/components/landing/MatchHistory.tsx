'use client'

import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface MatchHistoryMetric {
  label: string
  value: string
  trend: 'up' | 'down' | 'stable'
  trendValue?: string
}

interface MatchHistoryItem {
  id: string
  filename: string
  date: string
  metrics: MatchHistoryMetric[]
}


interface MatchHistoryProps {
  className?: string
  items?: MatchHistoryItem[]
}

export function MatchHistory({ className, items = [] }: MatchHistoryProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          Recent Analyses
        </h3>
        <button className="text-xs text-accent-blue hover:underline">
          View all
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <Card padding="sm">
            <p className="text-sm text-text-muted">
              No recent analyses yet.
            </p>
          </Card>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              padding="sm"
              hover
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.filename}
                  </p>
                  <p className="text-xs text-text-muted">{item.date}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {item.metrics.slice(0, 2).map((metric, idx) => (
                    <MetricBadge key={idx} metric={metric} />
                  ))}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Aggregate trends */}
      {/* Trends can be derived once real history data is available */}
    </div>
  )
}

function MetricBadge({ metric }: { metric: MatchHistoryMetric }) {
  const trendColors = {
    up: 'text-event-attack',
    down: 'text-event-shot',
    stable: 'text-text-muted',
  }

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  }

  return (
    <div className="text-right">
      <p className="text-xs text-text-muted">{metric.label}</p>
      <p className="text-sm font-medium text-text-primary">
        {metric.value}
        <span className={cn('ml-1 text-xs', trendColors[metric.trend])}>
          {trendIcons[metric.trend]}
        </span>
      </p>
    </div>
  )
}

