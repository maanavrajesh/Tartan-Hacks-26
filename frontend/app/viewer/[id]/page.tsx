'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayerWithOverlay, type VideoPlayerHandle } from '@/components/video'
import { Button } from '@/components/ui/Button'
import { videoApi } from '@/hooks/useVideo'

export default function ViewerPage() {
  const params = useParams()
  const videoId = params.id as string

  const videoRef = useRef<VideoPlayerHandle>(null)
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)

  useEffect(() => {
    setVideoSrc(videoApi.getVideoUrl(videoId))
  }, [videoId])

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
          <VideoPlayerWithOverlay videoSrc={videoSrc} ref={videoRef} />
        </div>
      </div>
    </div>
  )
}
