'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { formatTime, getRiskColor, getRiskLabel, aggregateRiskScores } from '@/lib/utils'
import type { RiskScore, VideoEvent } from '@/lib/types'
import { EVENT_LABELS } from '@/lib/types'

interface RiskStripProps {
  riskScores: RiskScore[]
  events?: VideoEvent[]
  duration: number
  currentTime: number
  onTimeClick: (time: number) => void
  className?: string
}

export function RiskStrip({
  riskScores,
  events = [],
  duration,
  currentTime,
  onTimeClick,
  className,
}: RiskStripProps) {
  const [hoveredBin, setHoveredBin] = useState<{
    startTime: number
    endTime: number
    avgScore: number
    maxScore: number
    factors: string[]
    eventSummary: {
      total: number
      topTypes: Array<{ type: string; count: number }>
    }
  } | null>(null)

  // Aggregate scores into bins for visualization
  const binSize = useMemo(() => {
    // Adjust bin size based on duration
    if (duration <= 60) return 2
    if (duration <= 300) return 5
    if (duration <= 600) return 5
    return 10
  }, [duration])

  const aggregatedScores = useMemo(() => {
    return aggregateRiskScores(riskScores, binSize)
  }, [riskScores, binSize])

  // Get top risk moments for highlighting
  const topRiskMoments = useMemo(() => {
    return aggregatedScores
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, 6)
  }, [aggregatedScores])

  const topSpikeSet = useMemo(() => {
    return new Set(topRiskMoments.map((moment) => moment.startTime))
  }, [topRiskMoments])

  // Find factors for a time range
  const getFactorsForBin = useCallback(
    (startTime: number, endTime: number): string[] => {
      const scores = riskScores.filter(
        (s) => s.timestamp >= startTime && s.timestamp < endTime
      )
      const allFactors = scores.flatMap((s) => s.factors)
      return [...new Set(allFactors)]
    },
    [riskScores]
  )

  const getEventSummaryForBin = useCallback(
    (startTime: number, endTime: number) => {
      const inWindow = events.filter(
        (event) => event.timestamp >= startTime && event.timestamp < endTime
      )
      const totals = inWindow.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topTypes = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => ({ type, count }))

      return { total: inWindow.length, topTypes }
    },
    [events]
  )

  const handleBinClick = useCallback(
    (bin: typeof aggregatedScores[0]) => {
      // Seek to the middle of the bin, or to max score point
      const targetScore = riskScores.find(
        (s) =>
          s.timestamp >= bin.startTime &&
          s.timestamp < bin.endTime &&
          s.score === bin.maxScore
      )
      onTimeClick(targetScore?.timestamp || (bin.startTime + bin.endTime) / 2)
    },
    [riskScores, onTimeClick]
  )

  const getPositionPercent = useCallback(
    (time: number) => {
      if (duration === 0) return 0
      return (time / duration) * 100
    },
    [duration]
  )

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            Risk Analysis
          </span>
          <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-secondary rounded">
            Model-assisted score
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-risk-low" />
            <span className="text-text-muted">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-risk-medium" />
            <span className="text-text-muted">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-risk-high" />
            <span className="text-text-muted">High</span>
          </div>
        </div>
      </div>

      {/* Risk strip visualization */}
      <div className="relative">
        {/* Main strip */}
        <div className="relative h-8 bg-bg-secondary rounded-lg overflow-hidden flex">
          {aggregatedScores.map((bin, index) => {
            const isSpike = topSpikeSet.has(bin.startTime)
            const isHovered = hoveredBin?.startTime === bin.startTime

            return (
              <div
                key={index}
                className={cn(
                  'relative h-full cursor-pointer transition-all',
                  isHovered && 'z-10'
                )}
                style={{
                  flex: 1,
                  backgroundColor: getRiskColor(bin.avgScore),
                  opacity: 0.4 + bin.avgScore * 0.6,
                }}
                onMouseEnter={() =>
                  setHoveredBin({
                    ...bin,
                    factors: getFactorsForBin(bin.startTime, bin.endTime),
                    eventSummary: getEventSummaryForBin(
                      bin.startTime,
                      bin.endTime
                    ),
                  })
                }
                onMouseLeave={() => setHoveredBin(null)}
                onClick={() => handleBinClick(bin)}
              >
                {/* Peak indicator for top spikes */}
                {isSpike && (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 bg-risk-high"
                    style={{ height: `${bin.maxScore * 100}%` }}
                  />
                )}

                {/* Hover effect */}
                {isHovered && (
                  <div className="absolute inset-0 bg-white/20 ring-2 ring-white/50" />
                )}
              </div>
            )
          })}
        </div>

        {/* Current time indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${getPositionPercent(currentTime)}%` }}
        >
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rounded-full" />
        </div>

        {/* Tooltip */}
        {hoveredBin && (
          <div
            className="absolute -top-2 z-30 transform -translate-y-full animate-fade-in pointer-events-none"
            style={{
              left: `${getPositionPercent((hoveredBin.startTime + hoveredBin.endTime) / 2)}%`,
              transform: 'translateX(-50%) translateY(-100%)',
            }}
          >
            <div className="bg-bg-card border border-border rounded-lg p-3 shadow-lg min-w-[180px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">
                  {formatTime(hoveredBin.startTime)} - {formatTime(hoveredBin.endTime)}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${getRiskColor(hoveredBin.maxScore)}20`,
                    color: getRiskColor(hoveredBin.maxScore),
                  }}
                >
                  {getRiskLabel(hoveredBin.maxScore)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Peak Risk:</span>
                  <span
                    className="font-medium"
                    style={{ color: getRiskColor(hoveredBin.maxScore) }}
                  >
                    {Math.round(hoveredBin.maxScore * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Avg Risk:</span>
                  <span className="font-medium text-text-primary">
                    {Math.round(hoveredBin.avgScore * 100)}%
                  </span>
                </div>
              </div>

              {hoveredBin.eventSummary.total > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-text-muted mb-1">
                    Events in window:
                  </p>
                  <div className="space-y-1 text-xs text-text-secondary">
                    {hoveredBin.eventSummary.topTypes.map((item) => (
                      <div key={item.type} className="flex justify-between">
                        <span>{EVENT_LABELS[item.type as keyof typeof EVENT_LABELS]}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hoveredBin.factors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-text-muted mb-1">Risk Factors:</p>
                  <div className="flex flex-wrap gap-1">
                    {hoveredBin.factors.slice(0, 3).map((factor) => (
                      <span
                        key={factor}
                        className="text-xs px-1.5 py-0.5 bg-bg-secondary rounded text-text-secondary"
                      >
                        {factor.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-accent-blue mt-2">Click to jump</p>
            </div>
          </div>
        )}
      </div>

      {/* Top risk moments quick access */}
      {topRiskMoments.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pt-1">
          <span className="text-xs text-text-muted whitespace-nowrap">
            Top risks:
          </span>
          {topRiskMoments.map((moment, i) => (
            <button
              key={i}
              onClick={() => handleBinClick(moment)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-bg-card hover:bg-bg-card-hover text-xs transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getRiskColor(moment.maxScore) }}
              />
              <span className="text-text-primary font-medium">
                {formatTime((moment.startTime + moment.endTime) / 2)}
              </span>
              <span className="text-text-muted">
                ({Math.round(moment.maxScore * 100)}%)
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
