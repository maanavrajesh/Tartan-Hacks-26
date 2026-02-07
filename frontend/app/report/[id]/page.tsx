'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string

  useEffect(() => {
    router.replace(`/viewer/${videoId}`)
  }, [router, videoId])

  return null
}
