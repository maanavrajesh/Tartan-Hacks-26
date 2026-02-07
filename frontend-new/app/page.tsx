'use client'

import { useCallback, useState } from 'react'
import { UploadCard } from '@/components/UploadCard'
import { MatchHistory, ProjectionCards, SoccerHero } from '@/components/landing'
import { BackgroundPaths } from '@/components/ui/background-paths'
import type { ProcessingStatus } from '@/lib/types'

export default function UploadPage() {
  const [heroState, setHeroState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle')

  const handleStatusChange = useCallback((status: ProcessingStatus) => {
    if (status === 'analyzing') {
      setHeroState('analyzing')
      return
    }
    if (status === 'complete') {
      setHeroState('complete')
      return
    }
    setHeroState('uploading')
  }, [])

  const handleFileStateChange = useCallback((ready: boolean) => {
    setHeroState(ready ? 'uploading' : 'idle')
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="fixed inset-0 opacity-50 pointer-events-none">
        <BackgroundPaths />
      </div>
      {/* Atmospheric background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_55%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_40%,_rgba(59,130,246,0.08),_transparent_45%)] pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px),
                           linear-gradient(to bottom, #fff 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-12">
          {/* Left panel */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-border-light/60 bg-bg-secondary px-3 py-1 text-xs uppercase tracking-[0.24em] text-text-muted">
                Vision XI
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-text-primary md:text-4xl">
                Vision XI turns match footage into tactical clarity in minutes.
              </h1>
              <p className="text-base text-text-secondary">
                Upload a full match, highlight, or training segment. We map pressure, shape, and
                possession so you can spot patterns and coach with confidence.
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                <span className="rounded-full border border-border bg-bg-secondary px-3 py-1">
                  4-3-3 shape detection
                </span>
                <span className="rounded-full border border-border bg-bg-secondary px-3 py-1">
                  Press triggers & transitions
                </span>
                <span className="rounded-full border border-border bg-bg-secondary px-3 py-1">
                  Possession chain insights
                </span>
              </div>
            </div>
            <UploadCard
              onStatusChange={handleStatusChange}
              onFileStateChange={handleFileStateChange}
            />
          </div>

          {/* Right panel */}
          <div className="space-y-8">
            <SoccerHero state={heroState} />
            <MatchHistory />
            <ProjectionCards />
          </div>
        </div>
      </div>
    </div>
  )
}
