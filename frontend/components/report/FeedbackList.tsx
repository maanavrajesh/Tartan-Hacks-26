'use client'

import { Card } from '@/components/ui/Card'

interface FeedbackListProps {
  feedback: string[]
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  if (feedback.length === 0) return null

  return (
    <Card variant="outlined" padding="md">
      <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
        Coaching Tips
      </h3>
      <ul className="space-y-2">
        {feedback.map((tip, idx) => (
          <li key={idx} className="flex gap-2 text-sm">
            <span className="text-event-attack mt-0.5 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="text-text-secondary">{tip}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
