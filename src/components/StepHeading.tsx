import { useEffect, useRef } from 'react'

interface StepHeadingProps {
  steps: string[]
  current: number
  title: string
  description?: string
}

export const StepHeading = ({ steps, current, title, description }: StepHeadingProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView?.({ block: 'start' })
  }, [current, title])

  return (
    <div className="step-heading">
      <p className="eyebrow" aria-live="polite">
        Step {current + 1} of {steps.length} · {steps[current]}
      </p>
      <div
        className="step-progress"
        role="progressbar"
        aria-label="Your progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-valuetext={`${steps[current]}, step ${current + 1} of ${steps.length}`}
      >
        {steps.map((step, index) => (
          <span key={step} className={index <= current ? 'step-progress-complete' : ''} />
        ))}
      </div>
      <h2 ref={headingRef} tabIndex={-1}>{title}</h2>
      {description ? <p className="step-description">{description}</p> : null}
    </div>
  )
}
