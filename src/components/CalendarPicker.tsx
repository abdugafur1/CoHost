import { useState } from 'react'

interface DateRangePickerProps {
  mode: 'range'
  startDate: string
  endDate: string
  onRangeChange: (startDate: string, endDate: string) => void
}

interface AvailabilityPickerProps {
  mode: 'availability'
  availableDates: string[]
  selectedDates: string[]
  onDatesChange: (dates: string[]) => void
}

type CalendarPickerProps = DateRangePickerProps | AvailabilityPickerProps

const dateToString = (date: Date) => {
  const year = date.getFullYear()
  const monthNumber = date.getMonth() + 1
  const dayNumber = date.getDate()
  const month = monthNumber < 10 ? `0${monthNumber}` : String(monthNumber)
  const day = dayNumber < 10 ? `0${dayNumber}` : String(dayNumber)

  return `${year}-${month}-${day}`
}

const stringToDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatDate = (date: string) =>
  stringToDate(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const CalendarPicker = (props: CalendarPickerProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    if (props.mode === 'range' && props.startDate) return startOfMonth(stringToDate(props.startDate))
    if (props.mode === 'availability' && props.availableDates[0]) {
      return startOfMonth(stringToDate(props.availableDates[0]))
    }
    return startOfMonth(new Date())
  })

  const today = dateToString(new Date())
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate()
  const leadingDays = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7
  const monthCells = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
  const currentMonth = startOfMonth(new Date())
  const canGoBack = previousMonth >= currentMonth

  const isSelected = (date: string) => {
    if (props.mode === 'availability') return props.selectedDates.indexOf(date) >= 0
    if (!props.startDate) return false
    if (!props.endDate) return date === props.startDate

    return date >= props.startDate && date <= props.endDate
  }

  const isUnavailable = (date: string) => {
    if (date < today) return true
    return props.mode === 'availability' && props.availableDates.indexOf(date) < 0
  }

  const selectDate = (date: string) => {
    if (props.mode === 'availability') {
      const selectedDates = props.selectedDates.indexOf(date) >= 0
        ? props.selectedDates.filter((selectedDate) => selectedDate !== date)
        : [...props.selectedDates, date]
      props.onDatesChange(selectedDates.sort())
      return
    }

    if (!props.startDate || props.endDate || date < props.startDate) {
      props.onRangeChange(date, '')
      return
    }

    props.onRangeChange(props.startDate, date)
    setIsCalendarOpen(false)
  }

  return (
    <div
      className={
        props.mode === 'range'
          ? 'calendar-range-picker'
          : 'calendar-picker calendar-picker-compact'
      }
    >
      {props.mode === 'range' ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`calendar-date-summary ${isCalendarOpen ? 'calendar-date-summary-active' : ''}`}
            aria-expanded={isCalendarOpen}
            aria-controls="event-date-calendar"
            onClick={() => setIsCalendarOpen((isOpen) => !isOpen)}
          >
            <span>Start date</span>
            <strong>{props.startDate ? formatDate(props.startDate) : 'Select a date'}</strong>
          </button>
          <button
            type="button"
            className={`calendar-date-summary ${isCalendarOpen ? 'calendar-date-summary-active' : ''}`}
            aria-expanded={isCalendarOpen}
            aria-controls="event-date-calendar"
            onClick={() => setIsCalendarOpen((isOpen) => !isOpen)}
          >
            <span>End date</span>
            <strong>{props.endDate ? formatDate(props.endDate) : 'Select a date'}</strong>
          </button>
        </div>
      ) : (
        <p className="mb-4 text-sm text-stone-600">
          Select the dates you are available
          {props.selectedDates.length ? ` · ${props.selectedDates.length} selected` : ''}
        </p>
      )}

      {props.mode === 'range' && !isCalendarOpen ? null : (
      <div
        id={props.mode === 'range' ? 'event-date-calendar' : undefined}
        className={props.mode === 'range' ? 'calendar-popover' : undefined}
      >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setVisibleMonth(previousMonth)}
          className="calendar-nav"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-stone-900" aria-live="polite">
          {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))
          }
          className="calendar-nav"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>

      <div className="calendar-grid mt-3" role="group" aria-label="Choose dates">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day} className="calendar-weekday" aria-hidden="true">
            {day}
          </span>
        ))}
        {monthCells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />

          const date = dateToString(
            new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day),
          )
          const selected = isSelected(date)
          const inRange =
            props.mode === 'range' &&
            Boolean(props.startDate && props.endDate && date >= props.startDate && date <= props.endDate)

          return (
            <button
              key={date}
              type="button"
              aria-label={`Select ${formatDate(date)}`}
              aria-pressed={selected}
              disabled={isUnavailable(date)}
              onClick={() => selectDate(date)}
              className={`calendar-day ${selected ? 'calendar-day-selected' : ''} ${
                inRange ? 'calendar-day-in-range' : ''
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {props.mode === 'range' ? (
        <p className="mt-3 text-xs text-stone-600">
          Select the first and last day.
        </p>
      ) : null}
      </div>
      )}
    </div>
  )
}

export default CalendarPicker
