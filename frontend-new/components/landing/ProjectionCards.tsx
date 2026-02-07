'use client'

import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface Projection {
  id: string
  title: string
  description: string
  type: 'warning' | 'insight' | 'positive'
  icon: 'pressure' | 'shape' | 'attack'
}

const projections: Projection[] = [
  {
    id: '1',
    title: 'Pressure Risk',
    description: 'High-risk pressure moments increase after minute 70 based on recent matches.',
    type: 'warning',
    icon: 'pressure',
  },
  {
    id: '2',
    title: 'Defensive Shape',
    description: 'Team compactness drops during transition phases.',
    type: 'insight',
    icon: 'shape',
  },
  {
    id: '3',
    title: 'Attack Efficiency',
    description: 'Attack entries are increasing, but shot conversion remains flat.',
    type: 'positive',
    icon: 'attack',
  },
]

interface ProjectionCardsProps {
  className?: string
}

export function ProjectionCards({ className }: ProjectionCardsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-text-secondary">
          Tactical Projections
        </h3>
        <span className="text-[10px] px-1.5 py-0.5 bg-bg-secondary rounded text-text-muted">
          Based on recent patterns
        </span>
      </div>

      <div className="space-y-2">
        {projections.map((projection) => (
          <ProjectionCard key={projection.id} projection={projection} />
        ))}
      </div>
    </div>
  )
}

function ProjectionCard({ projection }: { projection: Projection }) {
  const typeStyles = {
    warning: {
      bg: 'bg-event-press/10',
      border: 'border-event-press/30',
      icon: 'text-event-press',
    },
    insight: {
      bg: 'bg-accent-blue/10',
      border: 'border-accent-blue/30',
      icon: 'text-accent-blue',
    },
    positive: {
      bg: 'bg-event-attack/10',
      border: 'border-event-attack/30',
      icon: 'text-event-attack',
    },
  }

  const style = typeStyles[projection.type]

  return (
    <Card
      padding="sm"
      className={cn(style.bg, 'border', style.border)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', style.icon)}>
          <ProjectionIcon icon={projection.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">
            {projection.title}
          </p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            {projection.description}
          </p>
        </div>
      </div>
    </Card>
  )
}

function ProjectionIcon({ icon }: { icon: 'pressure' | 'shape' | 'attack' }) {
  if (icon === 'pressure') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  }

  if (icon === 'shape') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    )
  }

  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}
