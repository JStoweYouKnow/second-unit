import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, HelpCircle } from './icons'
import { getOnboardingGuide } from '../lib/onboardingGuide'

export default function OnboardingGuideModal({ role, open, onClose, onDismiss }) {
  const navigate = useNavigate()
  const guide = getOnboardingGuide(role)
  const steps = guide?.steps ?? []
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open, role])

  if (!open || !guide || steps.length === 0) return null

  const step = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  const handleDismiss = () => {
    onDismiss?.()
  }

  const handleClose = () => {
    onDismiss?.()
    onClose?.()
  }

  const goNext = () => {
    if (isLast) handleDismiss()
    else setStepIndex((i) => i + 1)
  }

  const handleCta = () => {
    if (step.cta?.path) {
      navigate(step.cta.path)
      handleClose()
    }
  }

  return (
    <div className="modal-overlay onboarding-guide-overlay" role="presentation" onClick={handleClose}>
      <div
        className="modal onboarding-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header onboarding-guide-header">
          <div>
            <div className="onboarding-guide-eyebrow">
              <HelpCircle size={14} aria-hidden />
              {guide.eyebrow}
            </div>
            <h2 id="onboarding-guide-title">{step.title}</h2>
          </div>
          <button type="button" className="btn-icon" onClick={handleClose} aria-label="Close guide">
            <X size={18} />
          </button>
        </div>

        {isFirst && guide.intro && (
          <p className="onboarding-guide-intro">{guide.intro}</p>
        )}

        <p className="onboarding-guide-body">{step.body}</p>

        {step.bullets?.length > 0 && (
          <ul className="onboarding-guide-list">
            {step.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {step.cta && (
          <button type="button" className="btn btn-secondary btn-sm onboarding-guide-cta" onClick={handleCta}>
            {step.cta.label}
          </button>
        )}

        <div className="onboarding-guide-footer">
          <div className="onboarding-guide-dots" role="tablist" aria-label="Guide steps">
            {steps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === stepIndex}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={`onboarding-guide-dot${i === stepIndex ? ' is-active' : ''}${i < stepIndex ? ' is-done' : ''}`}
                onClick={() => setStepIndex(i)}
              />
            ))}
          </div>

          <div className="onboarding-guide-actions">
            {!isFirst && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStepIndex((i) => i - 1)}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
              {isLast ? 'Got it' : (
                <>
                  Next <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="onboarding-guide-step-count">
          Step {stepIndex + 1} of {steps.length}
        </p>
      </div>
    </div>
  )
}
