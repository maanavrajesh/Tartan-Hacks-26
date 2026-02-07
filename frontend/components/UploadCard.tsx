'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProcessingProgress, type ProcessingStep } from '@/components/ui/ProgressBar'
import { validateVideoDuration, formatDuration } from '@/lib/utils'
import type { ProcessingStatus } from '@/lib/types'
import { videoApi } from '@/hooks/useVideo'

interface UploadCardProps {
  onUploadComplete?: (videoId: string) => void
  onStatusChange?: (status: ProcessingStatus) => void
  onFileStateChange?: (hasFile: boolean) => void
}

export function UploadCard({
  onUploadComplete,
  onStatusChange,
  onFileStateChange,
}: UploadCardProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('uploading')

  const processingSteps: ProcessingStep[] = [
    {
      id: 'upload',
      label: 'Upload',
      status: processingStatus === 'uploading' ? 'active' :
              ['processing', 'detecting', 'tracking', 'analyzing', 'complete'].includes(processingStatus) ? 'complete' : 'pending',
    },
    {
      id: 'detect',
      label: 'Detecting',
      status: processingStatus === 'detecting' ? 'active' :
              ['tracking', 'analyzing', 'complete'].includes(processingStatus) ? 'complete' : 'pending',
    },
    {
      id: 'track',
      label: 'Tracking',
      status: processingStatus === 'tracking' ? 'active' :
              ['analyzing', 'complete'].includes(processingStatus) ? 'complete' : 'pending',
    },
    {
      id: 'analyze',
      label: 'Analyzing',
      status: processingStatus === 'analyzing' ? 'active' :
              processingStatus === 'complete' ? 'complete' : 'pending',
    },
  ]

  const getVideoDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }

      video.onerror = () => {
        reject(new Error('Failed to load video metadata'))
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setError(null)
      setFile(null)
      setVideoDuration(null)
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
        setVideoUrl(null)
        sessionStorage.removeItem('sfi_uploaded_video_url')
      }

      // Check file type
      if (!selectedFile.type.startsWith('video/')) {
        setError('Please select a video file (MP4 recommended)')
        return
      }

      try {
        const duration = await getVideoDuration(selectedFile)
        const validation = validateVideoDuration(duration)

        if (!validation.valid) {
          setError(validation.error || 'Invalid video duration')
          return
        }

        const objectUrl = URL.createObjectURL(selectedFile)
        setFile(selectedFile)
        setVideoDuration(duration)
        setVideoUrl(objectUrl)
        sessionStorage.setItem('sfi_uploaded_video_url', objectUrl)
      } catch {
        setError('Failed to read video file. Please try a different file.')
      }
    },
    [getVideoDuration, videoUrl]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileSelect(selectedFile)
      }
    },
    [handleFileSelect]
  )

  const processVideo = useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setError(null)

    try {
      // Step 1: Upload video
      setProcessingStatus('uploading')
      console.log('Uploading video to backend...')
      const { videoId } = await videoApi.uploadVideo(file, 'soccer')
      console.log('Video uploaded, videoId:', videoId)

      // Step 2: Trigger processing
      setProcessingStatus('processing')
      console.log('Triggering video processing...')
      await videoApi.processVideo(videoId)
      console.log('Processing triggered')

      // Step 3: Poll for status updates
      let attempts = 0
      const maxAttempts = 3600 // 30 minutes max (0.5s * 3600 = 1800s) - detection can take a while
      const pollInterval = 500 // Poll every 500ms

      const pollStatus = async (): Promise<void> => {
        attempts++
        
        try {
          const status = await videoApi.getStatus(videoId)
          console.log(`Status update (attempt ${attempts}):`, status)

          // Map backend status to frontend status
          let frontendStatus: ProcessingStatus = 'processing'
          const statusLower = status.status.toLowerCase()

          if (statusLower.includes('upload')) {
            frontendStatus = 'uploading'
          } else if (statusLower.includes('detect')) {
            frontendStatus = 'detecting'
          } else if (statusLower.includes('track')) {
            frontendStatus = 'tracking'
          } else if (statusLower.includes('analyz')) {
            frontendStatus = 'analyzing'
          } else if (statusLower.includes('complete') || statusLower.includes('done')) {
            frontendStatus = 'complete'
          } else if (statusLower.includes('error') || statusLower.includes('fail')) {
            frontendStatus = 'error'
            setError(status.error || 'Processing failed')
            setIsProcessing(false)
            return
          }

          setProcessingStatus(frontendStatus)

          // Check if complete
          if (status.status === 'complete' || status.progress >= 100) {
            console.log('Processing complete!')
            setProcessingStatus('complete')
            await new Promise((resolve) => setTimeout(resolve, 1000)) // Brief delay to show completion

            // Navigate to viewer
            onUploadComplete?.(videoId)
            router.push(`/viewer/${videoId}`)
            return
          }

          // Continue polling if not complete
          if (attempts < maxAttempts) {
            setTimeout(pollStatus, pollInterval)
          } else {
            console.error('Polling timeout reached')
            setError('Processing is taking longer than expected. Please check back later.')
            setIsProcessing(false)
          }
        } catch (err) {
          console.error('Error polling status:', err)
          // Don't give up immediately - might be a temporary network issue
          if (attempts < maxAttempts) {
            setTimeout(pollStatus, pollInterval)
          } else {
            setError('Failed to get processing status. Please try again.')
            setIsProcessing(false)
          }
        }
      }

      // Start polling
      setTimeout(pollStatus, pollInterval)
    } catch (err) {
      console.error('Error processing video:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to process video'
      setError(errorMessage)
      setIsProcessing(false)
      setProcessingStatus('error')
    }
  }, [file, router, onUploadComplete])

  useEffect(() => {
    if (!isProcessing) return
    onStatusChange?.(processingStatus)
  }, [processingStatus, isProcessing, onStatusChange])

  useEffect(() => {
    onFileStateChange?.(!!file)
  }, [file, onFileStateChange])

  const handleProcess = useCallback(() => {
    if (!file) return
    processVideo()
  }, [file, processVideo])

  return (
    <Card variant="elevated" className="w-full max-w-xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Turn Soccer Match Film Into Tactical Intelligence
          </h1>
          <p className="text-text-secondary">
            Upload your match footage for instant soccer analysis
          </p>
        </div>

        {/* Upload Zone */}
        {!isProcessing ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-accent-blue bg-accent-blue/10'
                : file
                  ? 'border-event-attack bg-event-attack/5'
                  : 'border-border hover:border-border-light hover:bg-bg-card-hover'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleInputChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-event-attack/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-event-attack"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-medium text-text-primary">{file.name}</p>
                <p className="text-sm text-text-secondary">
                  Duration: {videoDuration ? formatDuration(videoDuration) : 'Loading...'}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setVideoDuration(null)
                    if (videoUrl) {
                      URL.revokeObjectURL(videoUrl)
                      setVideoUrl(null)
                      sessionStorage.removeItem('sfi_uploaded_video_url')
                    }
                  }}
                  className="text-sm text-event-shot hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-bg-secondary flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    Drop your video here or click to browse
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    Supported formats: MP4
                  </p>
                  <p className="text-sm text-text-muted">
                    Length: 30 seconds - 30 minutes
                  </p>
                  <p className="text-sm text-text-muted">
                    Best results: Clear view of players, minimal camera shake
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Processing State */
          <div className="py-8 space-y-6">
            <ProcessingProgress steps={processingSteps} />
            <p className="text-center text-text-secondary text-sm">
              {processingStatus === 'uploading' && 'Uploading match footage...'}
              {processingStatus === 'detecting' && 'Detecting players, ball, and lines...'}
              {processingStatus === 'tracking' && 'Tracking movement and possession...'}
              {processingStatus === 'analyzing' && 'Generating tactical insights...'}
              {processingStatus === 'complete' && 'Match analysis complete!'}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-event-shot/10 border border-event-shot/30">
            <svg
              className="w-5 h-5 text-event-shot flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-event-shot">{error}</p>
          </div>
        )}

        {/* Process Button */}
        {!isProcessing && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!file}
            onClick={handleProcess}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Analyze Match
          </Button>
        )}

        {/* Helper Text */}
        <p className="text-xs text-text-muted text-center">
          Longer videos surface the highest-impact moments automatically.
        </p>
      </div>
    </Card>
  )
}
