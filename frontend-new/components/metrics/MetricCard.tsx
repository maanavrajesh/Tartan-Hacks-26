'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Metric } from '@/lib/types'

interface MetricCardProps {
  metric: Metric
  chartType?: 'line' | 'bar' | 'area'
  onViewEvidence?: (eventIds: string[]) => void
  className?: string
}

export function MetricCard({
  metric,
  chartType = 'line',
  onViewEvidence,
  className,
}: MetricCardProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!metric.trend || !metric.trendLabels) return []
    return metric.trend.map((value, index) => ({
      label: metric.trendLabels?.[index] || `${index}`,
      value,
    }))
  }, [metric.trend, metric.trendLabels])

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (!metric.trend || metric.trend.length < 2) return 'stable'
    const first = metric.trend[0]
    const last = metric.trend[metric.trend.length - 1]
    if (last > first * 1.1) return 'up'
    if (last < first * 0.9) return 'down'
    return 'stable'
  }, [metric.trend])

  const trendColor =
    trendDirection === 'up'
      ? 'text-event-attack'
      : trendDirection === 'down'
        ? 'text-event-shot'
        : 'text-text-muted'

  const chartColor =
    trendDirection === 'up'
      ? '#22c55e'
      : trendDirection === 'down'
        ? '#ef4444'
        : '#3b82f6'

  const hasEvidence =
    metric.evidenceEvents && metric.evidenceEvents.length > 0

  return (
    <Card
      padding="md"
      hover={hasEvidence}
      className={cn('group', className)}
      onClick={
        hasEvidence
          ? () => onViewEvidence?.(metric.evidenceEvents!)
          : undefined
      }
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-text-secondary">
              {metric.name}
            </h3>
            {metric.context && (
              <span className="text-xs text-text-muted">{metric.context}</span>
            )}
          </div>
          {metric.trend && (
            <div className={cn('flex items-center gap-1', trendColor)}>
              {trendDirection === 'up' && (
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
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              )}
              {trendDirection === 'down' && (
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
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              )}
              {trendDirection === 'stable' && (
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
                    d="M5 12h14"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Big Number */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-text-primary">
            {typeof metric.value === 'number'
              ? metric.value.toLocaleString()
              : metric.value}
          </span>
          {metric.unit && (
            <span className="text-sm text-text-muted">{metric.unit}</span>
          )}
        </div>

        {/* Mini Chart */}
        {chartData.length > 0 && (
          <div className="h-16 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData}>
                  <Bar dataKey="value" fill={chartColor} radius={[2, 2, 0, 0]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#a0a0b0' }}
                  />
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    fill={`url(#gradient-${metric.id})`}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#a0a0b0' }}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#a0a0b0' }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Description */}
        {metric.description && (
          <p className="text-xs text-text-muted line-clamp-2">
            {metric.description}
          </p>
        )}

        {/* View Evidence Link */}
        {hasEvidence && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-text-muted">
              {metric.evidenceEvents!.length} evidence clip
              {metric.evidenceEvents!.length > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-accent-blue group-hover:underline">
              View Evidence →
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

// Metrics Grid Component
interface MetricsGridProps {
  metrics: Metric[]
  onViewEvidence?: (eventIds: string[]) => void
  className?: string
}

export function MetricsGrid({
  metrics,
  onViewEvidence,
  className,
}: MetricsGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
        className
      )}
    >
      {metrics.map((metric, index) => (
        <MetricCard
          key={metric.id}
          metric={metric}
          chartType={
            index % 3 === 0 ? 'area' : index % 3 === 1 ? 'bar' : 'line'
          }
          onViewEvidence={onViewEvidence}
        />
      ))}
    </div>
  )
}
