'use client'

import type { PlayerFeedback } from '@/lib/types'
import { Card } from '@/components/ui/Card'

interface StatsGridProps {
  player: PlayerFeedback
}

function StatCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <Card variant="outlined" padding="sm">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-text-primary">
        {value}
        {unit && <span className="text-sm font-normal text-text-secondary ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </Card>
  )
}

export function StatsGrid({ player }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatCard
        label="Avg Speed"
        value={player.avg_speed_kmh.toFixed(1)}
        unit="km/h"
      />
      <StatCard
        label="Max Speed"
        value={player.max_speed_kmh.toFixed(1)}
        unit="km/h"
        sub={player.top_speed_time_s !== null ? `at ${player.top_speed_time_s}s` : undefined}
      />
      <StatCard
        label="Distance"
        value={player.distance_m.toFixed(1)}
        unit="m"
      />
      <StatCard
        label="Ball Possession"
        value={player.possession_pct_of_present.toFixed(1)}
        unit="%"
        sub={`${player.possession_frames} frames`}
      />
      <StatCard
        label="Position"
        value={player.position_role ?? 'N/A'}
        sub={player.position_rank_pct !== null ? `${player.position_rank_pct.toFixed(0)}th percentile` : undefined}
      />
      <StatCard
        label="Presence"
        value={player.presence_total_s.toFixed(1)}
        unit="s"
      />
      <StatCard
        label="Ball Control"
        value={player.ball_control_pct.toFixed(1)}
        unit="%"
      />
      <StatCard
        label="Movement"
        value={player.movement_control_pct.toFixed(1)}
        unit="%"
      />
      <StatCard
        label="Field (Adv/Mid/Deep)"
        value={`${player.field_control_adv_pct.toFixed(0)} / ${player.field_control_mid_pct.toFixed(0)} / ${player.field_control_deep_pct.toFixed(0)}`}
        unit="%"
      />
    </div>
  )
}
