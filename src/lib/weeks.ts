import { addDays, format, parseISO } from 'date-fns'

/** Monday of the week containing `date` (YYYY-MM-DD), weeks are Mon–Sun */
export function weekStartMonday(dateStr: string): string {
  const d = parseISO(`${dateStr}T12:00:00`)
  const day = d.getDay() // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  return format(addDays(d, diff), 'yyyy-MM-dd')
}

/** All Mon–Sun week starts from campaign start through end (or today) */
export function campaignWeeks(
  startDate: string | null,
  endDate: string | null,
  throughDate?: string,
): string[] {
  if (!startDate) return []
  const first = weekStartMonday(startDate)
  const lastDay = throughDate || endDate || startDate
  const last = weekStartMonday(lastDay)
  const weeks: string[] = []
  let cursor = parseISO(`${first}T12:00:00`)
  const end = parseISO(`${last}T12:00:00`)
  while (cursor <= end) {
    weeks.push(format(cursor, 'yyyy-MM-dd'))
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export function weekRangeLabel(weekStart: string): { start: string; end: string; endDate: string } {
  const start = weekStart
  const endDate = format(addDays(parseISO(`${weekStart}T12:00:00`), 6), 'yyyy-MM-dd')
  return { start, end: endDate, endDate }
}

export function inWeek(dateStr: string, weekStart: string): boolean {
  const { endDate } = weekRangeLabel(weekStart)
  return dateStr >= weekStart && dateStr <= endDate
}
