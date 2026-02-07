'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { VideoArtifacts, OverlaySettings, VideoEvent } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface UseVideoOptions {
  videoId: string
}

interface UseVideoReturn {
  artifacts: VideoArtifacts
  isLoading: boolean
  error: string | null
  overlaySettings: OverlaySettings
  setOverlaySettings: (settings: Partial<OverlaySettings>) => void
  selectedEvent: VideoEvent | null
  selectEvent: (event: VideoEvent | null) => void
  currentTime: number
  setCurrentTime: (time: number) => void
  duration: number
  setDuration: (duration: number) => void
}

export function useVideo({ videoId }: UseVideoOptions): UseVideoReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Overlay toggle states
  const [overlaySettings, setOverlaySettingsState] = useState<OverlaySettings>({
    showPlayers: true,
    showBall: false,
    showTrackIds: false,
    showHeatmap: false,
    showRiskZones: true,
  })

  // Selected event state
  const [selectedEvent, setSelectedEvent] = useState<VideoEvent | null>(null)

  // Video time state
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const emptyArtifacts = useMemo<VideoArtifacts>(() => ({
    meta: {
      id: videoId,
      filename: videoId,
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      sport: 'soccer',
      uploadedAt: '',
      status: 'processing',
    },
    events: [],
    metrics: [],
    predictions: { riskScores: [], topRiskMoments: [] },
    insights: [],
    tracks: [],
  }), [videoId])

  const [artifacts, setArtifacts] = useState<VideoArtifacts>(emptyArtifacts)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    videoApi.getArtifacts(videoId)
      .then((data) => {
        if (!cancelled) {
          setArtifacts(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifacts')
          setArtifacts(emptyArtifacts)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [videoId, emptyArtifacts])

  // Update overlay settings
  const setOverlaySettings = useCallback(
    (newSettings: Partial<OverlaySettings>) => {
      setOverlaySettingsState((prev) => ({ ...prev, ...newSettings }))
    },
    []
  )

  // Select an event
  const selectEvent = useCallback((event: VideoEvent | null) => {
    setSelectedEvent(event)
  }, [])

  return {
    artifacts,
    isLoading,
    error,
    overlaySettings,
    setOverlaySettings,
    selectedEvent,
    selectEvent,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
  }
}

// API client pointing to Flask backend
export const videoApi = {
  async uploadVideo(file: File, _sport: string): Promise<{ videoId: string }> {
    const formData = new FormData()
    formData.append('video', file)

    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Upload failed')
    }

    return res.json()
  },

  async processVideo(videoId: string): Promise<{ jobId: string }> {
    const res = await fetch(`${API_BASE}/api/process/${videoId}`, {
      method: 'POST',
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to start processing')
    }

    return res.json()
  },

  async getStatus(videoId: string): Promise<{
    status: string
    progress: number
    currentStep: string
    error?: string
  }> {
    const res = await fetch(`${API_BASE}/api/status/${videoId}`)

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to get status')
    }

    return res.json()
  },

  async getArtifacts(videoId: string): Promise<VideoArtifacts> {
    const res = await fetch(`${API_BASE}/api/artifacts/${videoId}`)
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Artifacts not available')
    }
    return res.json()
  },

  getVideoUrl(videoId: string): string {
    return `${API_BASE}/api/video/${videoId}`
  },
}
