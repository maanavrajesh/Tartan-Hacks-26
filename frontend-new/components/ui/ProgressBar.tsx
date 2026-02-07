'use client'

import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  value: number // 0-100
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'gradient' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  label?: string
  animated?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const variants = {
    default: 'bg-accent-blue',
    gradient: 'bg-gradient-to-r from-accent-blue to-accent-purple',
    success: 'bg-event-attack',
    warning: 'bg-event-press',
    danger: 'bg-event-shot',
  }

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-text-secondary">{label}</span>
          {showLabel && (
            <span className="text-sm font-medium text-text-primary">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-bg-secondary rounded-full overflow-hidden',
          sizes[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variants[variant],
            animated && 'animate-pulse-slow'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Multi-step progress indicator
export interface ProcessingStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

export interface ProcessingProgressProps {
  steps: ProcessingStep[]
  currentStep?: string
}

export function ProcessingProgress({ steps, currentStep }: ProcessingProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  step.status === 'complete' &&
                    'bg-event-attack border-event-attack text-white',
                  step.status === 'active' &&
                    'bg-accent-blue/20 border-accent-blue text-accent-blue animate-pulse',
                  step.status === 'pending' &&
                    'bg-bg-secondary border-border text-text-muted',
                  step.status === 'error' &&
                    'bg-event-shot/20 border-event-shot text-event-shot'
                )}
              >
                {step.status === 'complete' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === 'error' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : step.status === 'active' ? (
                  <div className="w-2 h-2 bg-accent-blue rounded-full" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium text-center',
                  step.status === 'active' && 'text-accent-blue',
                  step.status === 'complete' && 'text-event-attack',
                  step.status === 'pending' && 'text-text-muted',
                  step.status === 'error' && 'text-event-shot'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  step.status === 'complete' ? 'bg-event-attack' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
