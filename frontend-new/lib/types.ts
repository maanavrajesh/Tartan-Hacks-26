// Video and Analysis Types

export type Sport = 'soccer'

export type EventType =
  | 'shot_attempt'
  | 'turnover'
  | 'press_moment'
  | 'attack_entry'
  | 'dead_zone'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Detection {
  frameIndex: number
  timestamp: number
  boxes: Array<{
    id: string
    class: 'person' | 'sports_ball'
    confidence: number
    bbox: BoundingBox
  }>
}

export interface Track {
  id: string
  class: 'person' | 'sports_ball'
  positions: Array<{
    timestamp: number
    x: number // normalized 0-1
    y: number // normalized 0-1
    confidence: number
  }>
}

export interface VideoEvent {
  id: string
  type: EventType
  timestamp: number
  endTimestamp?: number
  confidence: number
  players?: string[]
  zone?: string
  clipId?: string
  description?: string
}

export interface Metric {
  id: string
  name: string
  value: number
  unit?: string
  description?: string
  trend?: number[]
  trendLabels?: string[]
  evidenceEvents?: string[]
  context?: string // e.g., "Per 5 minutes"
}

export interface RiskScore {
  timestamp: number
  score: number // 0-1
  factors: string[]
}

export interface Prediction {
  riskScores: RiskScore[]
  topRiskMoments: Array<{
    timestamp: number
    score: number
    eventId?: string
    description?: string
  }>
}

export interface Insight {
  id: string
  claim: string
  evidenceEvents: string[]
  whyItMatters: string
  action: string
  drillUrl?: string
  goal: string
}

export interface VideoMeta {
  id: string
  filename: string
  duration: number // seconds
  width: number
  height: number
  fps: number
  sport: Sport
  uploadedAt: string
  status: ProcessingStatus
}

export type ProcessingStatus =
  | 'uploading'
  | 'processing'
  | 'detecting'
  | 'tracking'
  | 'analyzing'
  | 'complete'
  | 'error'

export interface ProcessingProgress {
  status: ProcessingStatus
  progress: number // 0-100
  currentStep: string
  error?: string
}

export interface VideoArtifacts {
  meta: VideoMeta
  events: VideoEvent[]
  metrics: Metric[]
  predictions: Prediction
  insights: Insight[]
  tracks?: Track[]
}

// UI State Types

export interface OverlaySettings {
  showPlayers: boolean
  showBall: boolean
  showTrackIds: boolean
  showHeatmap: boolean
  showRiskZones: boolean
}

export interface TimelineZoom {
  level: 'overview' | 'focused'
  centerTime?: number
  windowSize: number // seconds visible
}

export interface SelectedEvent {
  eventId: string
  event: VideoEvent
}

// Color mapping for events
export const EVENT_COLORS: Record<EventType, string> = {
  shot_attempt: '#ef4444',
  turnover: '#f97316',
  press_moment: '#eab308',
  attack_entry: '#22c55e',
  dead_zone: '#6b7280',
}

export const EVENT_LABELS: Record<EventType, string> = {
  shot_attempt: 'Shot Attempt',
  turnover: 'Turnover',
  press_moment: 'Press Moment',
  attack_entry: 'Attack Entry',
  dead_zone: 'Dead Zone',
}
