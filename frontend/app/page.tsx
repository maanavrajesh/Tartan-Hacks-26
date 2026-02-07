'use client'

import { useCallback, useState } from 'react'
import { UploadCard } from '@/components/UploadCard'
import { BackgroundPaths } from '@/components/ui/background-paths'
import type { ProcessingStatus } from '@/lib/types'

export default function UploadPage() {
  const [, setHeroState] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle')

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
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_55%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_40%,_rgba(59,130,246,0.08),_transparent_45%)] pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-xl px-6 py-16 lg:py-24">
        <div className="space-y-8 text-center">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-border-light/60 bg-bg-secondary px-3 py-1 text-xs uppercase tracking-[0.24em] text-text-muted">
              VisionXI
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-text-primary md:text-4xl">
              Turn match footage into tactical clarity.
            </h1>
            <p className="text-base text-text-secondary">
              Upload your match video. Our model detects players, tracks movement,
              assigns teams, and measures speed — all rendered into your video.
            </p>
          </div>
          <UploadCard
            onStatusChange={handleStatusChange}
            onFileStateChange={handleFileStateChange}
          />
        </div>
      </div>
    </div>
  )
}
