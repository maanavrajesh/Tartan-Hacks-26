'use client'

import Link from 'next/link'
import type { PlayerFeedback } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { formatTime } from '@/lib/utils'

interface KeyMomentsProps {
  player: PlayerFeedback
  videoId: string
}

interface Moment {
  time: number
  label: string
  detail?: string
}

export function KeyMoments({ player, videoId }: KeyMomentsProps) {
  const moments: Moment[] = []

  // Peak speed moment
  if (player.top_speed_time_s !== null) {
    moments.push({
      time: player.top_speed_time_s,
      label: 'Peak speed',
      detail: `${player.max_speed_kmh.toFixed(1)} km/h`,
    })
  }

  // Ball possession windows
  player.possession_windows_s.forEach((w) => {
    moments.push({
      time: w.t0,
      label: 'Ball possession',
      detail: w.t1 > w.t0 ? `${(w.t1 - w.t0).toFixed(1)}s duration` : undefined,
    })
  })

  // First appearance
  if (player.presence_windows_s.length > 0) {
    moments.push({
      time: player.presence_windows_s[0].t0,
      label: 'First appearance',
    })
  }

  // Sort by time
  moments.sort((a, b) => a.time - b.time)

  if (moments.length === 0) {
    return (
      <Card variant="outlined" padding="md">
        <p className="text-text-muted text-sm">No key moments detected for this player.</p>
      </Card>
    )
  }

  return (
    <Card variant="outlined" padding="md">
      <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
        Key Moments
      </h3>
      <div className="space-y-2">
        {moments.map((moment, idx) => (
          <Link
            key={idx}
            href={`/viewer/${videoId}?t=${moment.time}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-card-hover transition-colors group"
          >
            <span className="text-xs font-mono text-accent-blue bg-accent-blue/10 px-2 py-1 rounded min-w-[60px] text-center">
              {formatTime(moment.time)}
            </span>
            <span className="text-sm text-text-primary group-hover:text-accent-blue transition-colors">
              {moment.label}
            </span>
            {moment.detail && (
              <span className="text-xs text-text-muted ml-auto">{moment.detail}</span>
            )}
            <svg
              className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors ml-1 flex-shrink-0"
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
            </svg>
          </Link>
        ))}
      </div>
    </Card>
  )
}
