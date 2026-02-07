import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatConfidence(confidence: number): string {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-event-attack'
  if (confidence >= 0.5) return 'text-event-press'
  return 'text-event-dead'
}

export function getRiskColor(score: number): string {
  if (score >= 0.7) return '#ef4444' // risk-high
  if (score >= 0.4) return '#eab308' // risk-medium
  return '#22c55e' // risk-low
}

export function getRiskLabel(score: number): string {
  if (score >= 0.7) return 'High Risk'
  if (score >= 0.4) return 'Medium Risk'
  return 'Low Risk'
}

export function validateVideoDuration(durationSeconds: number): {
  valid: boolean
  error?: string
} {
  const MIN_DURATION = 30 // seconds
  const MAX_DURATION = 30 * 60 // 30 minutes

  if (durationSeconds < MIN_DURATION) {
    return {
      valid: false,
      error: `Video too short - please upload at least ${MIN_DURATION} seconds of play.`,
    }
  }

  if (durationSeconds > MAX_DURATION) {
    return {
      valid: false,
      error: `Video too long - maximum supported length is 30 minutes for analysis.`,
    }
  }

  return { valid: true }
}

export function aggregateRiskScores(
  scores: Array<{ timestamp: number; score: number }>,
  binSize: number = 5
): Array<{ startTime: number; endTime: number; avgScore: number; maxScore: number }> {
  if (scores.length === 0) return []

  const maxTime = Math.max(...scores.map((s) => s.timestamp))
  const bins: Array<{ startTime: number; endTime: number; scores: number[] }> = []

  for (let t = 0; t <= maxTime; t += binSize) {
    bins.push({
      startTime: t,
      endTime: t + binSize,
      scores: [],
    })
  }

  scores.forEach((s) => {
    const binIndex = Math.floor(s.timestamp / binSize)
    if (bins[binIndex]) {
      bins[binIndex].scores.push(s.score)
    }
  })

  return bins.map((bin) => ({
    startTime: bin.startTime,
    endTime: bin.endTime,
    avgScore: bin.scores.length > 0 ? bin.scores.reduce((a, b) => a + b, 0) / bin.scores.length : 0,
    maxScore: bin.scores.length > 0 ? Math.max(...bin.scores) : 0,
  }))
}

export function findNearestEvent<T extends { timestamp: number }>(
  events: T[],
  targetTime: number
): T | null {
  if (events.length === 0) return null

  return events.reduce((nearest, event) => {
    const nearestDiff = Math.abs(nearest.timestamp - targetTime)
    const eventDiff = Math.abs(event.timestamp - targetTime)
    return eventDiff < nearestDiff ? event : nearest
  })
}

export function groupEventsByType<T extends { type: string }>(
  events: T[]
): Record<string, T[]> {
  return events.reduce(
    (groups, event) => {
      const type = event.type
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(event)
      return groups
    },
    {} as Record<string, T[]>
  )
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
