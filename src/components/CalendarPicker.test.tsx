/// <reference types="node" />
import { readFileSync } from 'node:fs'
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarPicker from './CalendarPicker'
const calendarStyles = readFileSync('src/App.css', 'utf8')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 9, 12))
})
afterEach(() => vi.useRealTimers())

const AvailabilityCalendar = () => {
  const [dates, setDates] = useState<string[]>([])
  return <CalendarPicker mode="availability" availableDates={['2026-11-08', '2026-11-10', '2026-12-01']} selectedDates={dates} onDatesChange={setDates} />
}

const dateButton = (month: number, day: number) => screen.getByRole('button', {
  name: `Select ${new Date(2026, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
})

describe('CalendarPicker', () => {
  it('keeps availability rows compact and dates readable in a wide participation form', () => {
    const style = document.createElement('style')
    style.textContent = calendarStyles
    document.head.appendChild(style)
    try {
      const { container } = render(<AvailabilityCalendar />)
      const picker = container.querySelector('.calendar-picker-compact')!
      const grid = screen.getByRole('group', { name: 'Choose dates' })
      const day = dateButton(11, 10)
      // JSDOM checks the CSS cascade; it does not perform browser geometry layout.
      expect(getComputedStyle(picker).maxWidth).toBe('384px')
      expect(getComputedStyle(grid).gridAutoRows).toBe('40px')
      expect(getComputedStyle(day).height).toBe('40px')
      expect(getComputedStyle(day).aspectRatio).toBe('auto')
      expect(getComputedStyle(day).fontSize).toBe('15px')
      fireEvent.click(day)
      expect(day).toHaveAttribute('aria-pressed', 'true')
      expect(getComputedStyle(day).color).toBe('rgb(255, 255, 255)')
    } finally {
      style.remove()
    }
  })

  it('preserves availability restrictions, toggling, and month navigation', () => {
    render(<AvailabilityCalendar />)
    expect(dateButton(11, 8)).toBeDisabled()
    expect(dateButton(11, 11)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
    fireEvent.click(dateButton(11, 10))
    expect(dateButton(11, 10)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    fireEvent.click(dateButton(12, 1))
    expect(screen.getByText(/2 selected/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(dateButton(11, 10)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(dateButton(11, 10))
    expect(dateButton(11, 10)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/1 selected/)).toBeTruthy()
  })

  it('preserves range selection and closes the popover after choosing the end date', () => {
    const onRangeChange = vi.fn()
    const { rerender } = render(<CalendarPicker mode="range" startDate="" endDate="" onRangeChange={onRangeChange} />)
    fireEvent.click(screen.getByRole('button', { name: /start date/i }))
    fireEvent.click(dateButton(11, 10))
    expect(onRangeChange).toHaveBeenLastCalledWith('2026-11-10', '')
    rerender(<CalendarPicker mode="range" startDate="2026-11-10" endDate="" onRangeChange={onRangeChange} />)
    fireEvent.click(dateButton(11, 12))
    expect(onRangeChange).toHaveBeenLastCalledWith('2026-11-10', '2026-11-12')
    expect(screen.queryByRole('group', { name: 'Choose dates' })).toBeNull()
  })
})
