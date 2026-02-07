'use client'

import { PitchMap } from './PitchMap'
import { cn } from '@/lib/utils'

type HeroState = 'idle' | 'uploading' | 'analyzing' | 'complete'

interface SoccerHeroProps {
  state: HeroState
  className?: string
}

export function SoccerHero({ state, className }: SoccerHeroProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Background glow effects */}
      <div className="absolute -inset-4 bg-gradient-to-r from-[#1a472a]/20 via-transparent to-[#1a472a]/20 blur-3xl pointer-events-none" />

      {/* Main pitch visualization */}
      <div className="relative">
        <PitchMap state={state} />

        {/* Decorative corner accents */}
        <div className="absolute -top-2 -left-2 w-8 h-8 border-l-2 border-t-2 border-[#2d5a3d]/50 rounded-tl-lg" />
        <div className="absolute -top-2 -right-2 w-8 h-8 border-r-2 border-t-2 border-[#2d5a3d]/50 rounded-tr-lg" />
        <div className="absolute -bottom-2 -left-2 w-8 h-8 border-l-2 border-b-2 border-[#2d5a3d]/50 rounded-bl-lg" />
        <div className="absolute -bottom-2 -right-2 w-8 h-8 border-r-2 border-b-2 border-[#2d5a3d]/50 rounded-br-lg" />
      </div>

      {/* Status indicators below pitch */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <StatusIndicator
          label="Pitch Control"
          active={state === 'analyzing'}
          color="blue"
        />
        <StatusIndicator
          label="Pressure Zones"
          active={state === 'analyzing'}
          color="yellow"
        />
        <StatusIndicator
          label="Risk Detection"
          active={state === 'analyzing'}
          color="red"
        />
      </div>
    </div>
  )
}

function StatusIndicator({
  label,
  active,
  color,
}: {
  label: string
  active: boolean
  color: 'blue' | 'yellow' | 'red'
}) {
  const colors = {
    blue: 'bg-accent-blue',
    yellow: 'bg-event-press',
    red: 'bg-event-shot',
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-all duration-300',
          active ? colors[color] : 'bg-text-muted/30',
          active && 'animate-pulse'
        )}
      />
      <span
        className={cn(
          'text-xs transition-colors',
          active ? 'text-text-secondary' : 'text-text-muted'
        )}
      >
        {label}
      </span>
    </div>
  )
}
