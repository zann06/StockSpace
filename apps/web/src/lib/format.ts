/** Indonesian-locale formatters. All UI text is id-ID per the design reference. */

const numberFormat = new Intl.NumberFormat('id-ID')
const compactCurrencyFormat = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const dayMonthFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
})
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short' })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** "Rp 1.250.000" */
export function formatCurrency(value: number): string {
  return `Rp ${numberFormat.format(Math.round(value))}`
}

/** "Rp 190,5 jt" — compact form for KPI cards; `title` should carry the full value. */
export function formatCompactCurrency(value: number): string {
  return `Rp ${compactCurrencyFormat.format(value)}`
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** "10:24" */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isYesterday(date: Date, now: Date): boolean {
  const prev = new Date(now)
  prev.setDate(prev.getDate() - 1)
  return isSameDay(date, prev)
}

/** "Hari ini 10:24", "Kemarin 15:45", or "12 Apr 09:12". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = formatTime(date)
  if (isSameDay(date, now)) return `Hari ini ${time}`
  if (isYesterday(date, now)) return `Kemarin ${time}`
  return `${dayMonthFormat.format(date)} ${time}`
}

/** "Sen", "Sel", … for chart axis labels. */
export function formatWeekday(date: Date): string {
  return weekdayFormat.format(date)
}
