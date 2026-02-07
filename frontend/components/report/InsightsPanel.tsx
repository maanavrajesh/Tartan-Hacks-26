'use client'

import type { LLMFeedback } from '@/lib/types'
import { Card } from '@/components/ui/Card'

interface InsightsPanelProps {
  llmFeedback: LLMFeedback | null
}

export function InsightsPanel({ llmFeedback }: InsightsPanelProps) {
  if (!llmFeedback) {
    return (
      <Card variant="outlined" padding="md">
        <p className="text-text-muted text-sm">
          LLM insights not available. Set OPENROUTER_API_KEY to enable AI-powered coaching analysis.
        </p>
      </Card>
    )
  }

  const { quantitative_summary, insights, action_plan } = llmFeedback

  return (
    <div className="space-y-4">
      {/* Quantitative Summary */}
      <Card variant="outlined" padding="md">
        <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
          Summary
        </h3>
        <div className="space-y-2">
          {quantitative_summary.ball_control && (
            <div>
              <span className="text-xs text-accent-blue font-medium">Ball Control: </span>
              <span className="text-sm text-text-secondary">{quantitative_summary.ball_control}</span>
            </div>
          )}
          {quantitative_summary.movement && (
            <div>
              <span className="text-xs text-accent-blue font-medium">Movement: </span>
              <span className="text-sm text-text-secondary">{quantitative_summary.movement}</span>
            </div>
          )}
          {quantitative_summary.pressure_context && (
            <div>
              <span className="text-xs text-accent-blue font-medium">Pressure: </span>
              <span className="text-sm text-text-secondary">{quantitative_summary.pressure_context}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Insights */}
      {insights.map((insight, idx) => (
        <Card key={idx} variant="outlined" padding="md">
          <h4 className="text-sm font-semibold text-text-primary mb-2">{insight.title}</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">What happened</p>
              <p className="text-sm text-text-secondary">{insight.what_happened}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Why it matters</p>
              <p className="text-sm text-text-secondary">{insight.why_it_matters}</p>
            </div>
            {insight.how_to_improve?.length > 0 && (
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">How to improve</p>
                <ul className="space-y-1">
                  {insight.how_to_improve.map((tip, i) => (
                    <li key={i} className="text-sm text-text-secondary flex gap-2">
                      <span className="text-accent-blue mt-0.5">-</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Action Plan */}
      {action_plan && (
        <Card variant="elevated" padding="md" className="border-accent-blue/30">
          <h3 className="text-sm font-semibold text-accent-blue mb-2 uppercase tracking-wider">
            Action Plan
          </h3>
          <div className="space-y-1.5">
            <p className="text-sm text-text-primary">
              <span className="font-medium">Focus: </span>
              {action_plan.focus}
            </p>
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Next step: </span>
              {action_plan.next_step}
            </p>
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Success: </span>
              {action_plan.success_indicator}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
