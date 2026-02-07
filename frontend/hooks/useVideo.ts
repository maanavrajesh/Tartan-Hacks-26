const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const videoApi = {
  async uploadVideo(file: File): Promise<{ videoId: string }> {
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

  getVideoUrl(videoId: string): string {
    return `${API_BASE}/api/video/${videoId}`
  },

  getDownloadUrl(videoId: string): string {
    return `${API_BASE}/api/download/${videoId}`
  },

  async getFeedback(videoId: string) {
    const res = await fetch(`${API_BASE}/api/feedback/${videoId}`)
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Feedback not available')
    }
    return res.json()
  },
}
