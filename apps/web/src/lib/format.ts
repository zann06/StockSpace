/**
 * Locale-aware formatters (id-ID default per the design reference). The active
 * locale is set by the I18nProvider; "Hari ini/Kemarin" adjust to English when
 * the app language is English.
 */

let activeLocale: 'id-ID' | 'en-US' = 'id-ID'

export function setActiveLocale(locale: 'id-ID' | 'en-US') {
  activeLocale = locale
}

const numberFormat = new Intl.NumberFormat('id-ID')
const compactCurrencyId = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const compactCurrencyEn = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const dayMonthFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
})
const dayMonthFormatEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
})
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short' })
const weekdayFormatEn = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** "Rp 1.250.000" */
export function formatCurrency(value: number): string {
  return `Rp ${numberFormat.format(Math.round(value))}`
}

/** "Rp 190,5 jt" / "Rp 190.5M" — compact KPI form; `title` carries the full value. */
export function formatCompactCurrency(value: number): string {
  const compact = activeLocale === 'en-US' ? compactCurrencyEn : compactCurrencyId
  return `Rp ${compact.format(value)}`
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

/** "Hari ini 10:24" / "Today 10:24", "Kemarin", or "12 Apr 09:12". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = formatTime(date)
  const english = activeLocale === 'en-US'
  if (isSameDay(date, now)) return `${english ? 'Today' : 'Hari ini'} ${time}`
  if (isYesterday(date, now)) return `${english ? 'Yesterday' : 'Kemarin'} ${time}`
  return `${(english ? dayMonthFormatEn : dayMonthFormat).format(date)} ${time}`
}

/** "Sen"/"Mon", … for chart axis labels. */
export function formatWeekday(date: Date): string {
  return (activeLocale === 'en-US' ? weekdayFormatEn : weekdayFormat).format(date)
}
