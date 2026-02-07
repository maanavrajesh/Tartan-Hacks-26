'use client'

import type { PlayerFeedback } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PlayerSelectorProps {
  players: PlayerFeedback[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function PlayerSelector({ players, selectedId, onSelect }: PlayerSelectorProps) {
  const team1 = players.filter((p) => p.team === 1)
  const team2 = players.filter((p) => p.team === 2)
  const unknown = players.filter((p) => p.team !== 1 && p.team !== 2)

  const groups = [
    { label: 'Team 1', players: team1, color: 'bg-accent-blue' },
    { label: 'Team 2', players: team2, color: 'bg-accent-purple' },
    ...(unknown.length > 0 ? [{ label: 'Other', players: unknown, color: 'bg-event-dead' }] : []),
  ]

  return (
    <div className="space-y-3">
      {groups.map((group) =>
        group.players.length > 0 ? (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-2.5 h-2.5 rounded-full', group.color)} />
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                {group.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.players.map((player) => (
                <button
                  key={player.player_id}
                  onClick={() => onSelect(player.player_id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    selectedId === player.player_id
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-card hover:bg-bg-card-hover text-text-secondary border border-border'
                  )}
                >
                  Player {player.player_id}
                </button>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}
