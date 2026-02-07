'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayerWithOverlay, type VideoPlayerHandle } from '@/components/video'
import { Button } from '@/components/ui/Button'
import { videoApi } from '@/hooks/useVideo'

export default function ViewerPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const videoId = params.id as string
  const startTime = searchParams.get('t')

  const videoRef = useRef<VideoPlayerHandle>(null)
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)
  const [hasSeeked, setHasSeeked] = useState(false)

  useEffect(() => {
    setVideoSrc(videoApi.getVideoUrl(videoId))
  }, [videoId])

  // Auto-seek to timestamp from ?t= query param once video metadata loads
  const handleDurationChange = () => {
    if (startTime && !hasSeeked && videoRef.current) {
      const t = parseFloat(startTime)
      if (!isNaN(t) && t > 0) {
        videoRef.current.seekTo(t)
        setHasSeeked(true)
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-text-primary font-semibold">Match Analysis</h1>
              <p className="text-xs text-text-muted">Processed by VisionXI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/report/${videoId}`}>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Player Report
              </Button>
            </Link>
            <a href={videoApi.getDownloadUrl(videoId)}>
              <Button variant="secondary" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </Button>
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center p-4">
        <div className="w-full max-w-[1200px]">
          <VideoPlayerWithOverlay
            videoSrc={videoSrc}
            ref={videoRef}
            onDurationChange={handleDurationChange}
          />
        </div>
      </div>
    </div>
  )
}
