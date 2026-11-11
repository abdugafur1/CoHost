import { useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import CalendarPicker from './CalendarPicker'
import { StepHeading } from './StepHeading'
import type { HostFormValues } from './DashboardComponents'

interface HostEventWizardProps {
  hostForm: HostFormValues
  feedback: { type: 'success' | 'error'; message: string } | null
  feedbackRef: RefObject<HTMLParagraphElement | null>
  isPublishing: boolean
  onFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onRangeChange: (startDate: string, endDate: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onReset: () => void
}

const steps = ['Title', 'Location', 'Dates', 'Capacity', 'Audience', 'Description', 'Review']
const titles = [
  'What is your event called?',
  'Where will it happen?',
  'When are you planning it?',
  'How many people can join?',
  'Who is the event for?',
  'Tell people about your event',
  'Ready to publish?',
]

export const HostEventWizard = ({
  hostForm,
  feedback,
  feedbackRef,
  isPublishing,
  onFieldChange,
  onRangeChange,
  onSubmit,
  onReset,
}: HostEventWizardProps) => {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validationError = (index: number) => {
    if (index === 0 && !hostForm.title.trim()) return 'Give your event a title to continue.'
    if (index === 1 && !hostForm.location.trim()) return 'Add a location to continue.'
    if (index === 2 && (
      !hostForm.startDate || !hostForm.endDate || hostForm.endDate < hostForm.startDate
    )) return 'Choose a complete event date range to continue.'
    if (index === 3 && (
      !Number.isInteger(Number(hostForm.capacity)) || Number(hostForm.capacity) < 1
    )) return 'Capacity must be a whole number of at least one.'
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPublishing) return
    const invalidStep = Array.from({ length: step + 1 }, (_, index) => index)
      .find((index) => validationError(index))
    if (invalidStep !== undefined) {
      setStep(invalidStep)
      setError(validationError(invalidStep))
      return
    }
    setError(null)
    if (step < steps.length - 1) setStep(step + 1)
    else onSubmit(event)
  }

  if (feedback?.type === 'success') {
    return (
      <section id="host" className="panel guided-panel completion-panel">
        <p className="eyebrow">All done</p>
        <h2>Your event is published</h2>
        <p ref={feedbackRef} role="status" className="event-feedback event-feedback-success">
          {feedback.message}
        </p>
        <p>Other students and clubs can now find your event and send requests to join.</p>
        <div className="wizard-actions">
          <a href="#manage" className="button-primary">View my events</a>
          <button type="button" className="button-secondary" onClick={() => {
            setStep(0)
            setError(null)
            onReset()
          }}>Create another event</button>
        </div>
      </section>
    )
  }

  return (
    <section id="host" className="panel guided-panel">
      <StepHeading steps={steps} current={step} title={titles[step]}
        description={step === 6
          ? 'Check the details below. You can go back to make changes before publishing.'
          : 'One detail at a time. You can go back without losing your answers.'} />
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <fieldset disabled={isPublishing} className="wizard-fields">
          {step === 0 ? (
            <label className="form-field">
              <span>Event title</span>
              <input name="title" value={hostForm.title} onChange={onFieldChange}
                className="input" placeholder="Campus wellness fair" aria-required="true" />
            </label>
          ) : null}
          {step === 1 ? (
            <label className="form-field">
              <span>Event location</span>
              <input name="location" value={hostForm.location} onChange={onFieldChange}
                className="input" placeholder="Student activity center" aria-required="true" />
            </label>
          ) : null}
          {step === 2 ? (
            <fieldset>
              <legend className="mb-2">Event dates</legend>
              <CalendarPicker mode="range" startDate={hostForm.startDate} endDate={hostForm.endDate}
                onRangeChange={onRangeChange} />
            </fieldset>
          ) : null}
          {step === 3 ? (
            <label className="form-field">
              <span>Event capacity</span>
              <input name="capacity" type="number" min="1" step="1" value={hostForm.capacity}
                onChange={onFieldChange} className="input" aria-required="true" />
            </label>
          ) : null}
          {step === 4 ? (
            <label className="form-field">
              <span>Event audience</span>
              <select name="audience" value={hostForm.audience} onChange={onFieldChange} className="input">
                <option value="everyone">Everyone (students and organizations)</option>
                <option value="organizations">Organizations only</option>
              </select>
            </label>
          ) : null}
          {step === 5 ? (
            <label className="form-field">
              <span>Event description (optional)</span>
              <textarea name="description" value={hostForm.description} onChange={onFieldChange}
                className="input" placeholder="What can people look forward to?" />
            </label>
          ) : null}
          {step === 6 ? (
            <dl className="review-details">
              <div><dt>Title</dt><dd>{hostForm.title}</dd></div>
              <div><dt>Location</dt><dd>{hostForm.location}</dd></div>
              <div><dt>Dates</dt><dd>{hostForm.startDate} – {hostForm.endDate}</dd></div>
              <div><dt>Capacity</dt><dd>{hostForm.capacity} people</dd></div>
              <div><dt>Audience</dt><dd>{hostForm.audience === 'everyone'
                ? 'Students and organizations' : 'Organizations only'}</dd></div>
              <div><dt>Description</dt><dd>{hostForm.description.trim() || 'Looking for a co-hosting partner.'}</dd></div>
            </dl>
          ) : null}
        </fieldset>
        {error ? <p role="alert" className="event-feedback event-feedback-error">{error}</p> : null}
        {feedback?.type === 'error' ? (
          <p ref={feedbackRef} role="alert" className="event-feedback event-feedback-error">{feedback.message}</p>
        ) : null}
        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="button-secondary" disabled={isPublishing}
              onClick={() => { setError(null); setStep(step - 1) }}>Back</button>
          ) : <a href="#home" className="button-secondary">Cancel</a>}
          <button key={step} type="submit" className="button-primary" disabled={isPublishing}>
            {isPublishing ? 'Publishing...' : step === 6 ? 'Publish event' : 'Next'}
          </button>
        </div>
      </form>
    </section>
  )
}
