/**
 * Format duration in seconds to a human-readable string.
 * E.g. formatDuration(600) → "10 мин"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} сек`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) return `${minutes} мин`
  return `${minutes} мин ${remainingSeconds} сек`
}

/**
 * Round a unit-scaled value for display: one decimal place below 10, and also
 * within ~3% of any integer boundary so the rounded label never crosses it.
 *
 * IN-03: `toFixed(0)` rounding could display a size that contradicts the plan
 * limit — e.g. a 1.04 MB file rounded to "1 МБ" then rejected for being
 * "больше 1 МБ", which reads as a contradiction. Keeping one decimal near a
 * boundary makes such a file read "1,1 МБ", so the displayed size and the
 * rejection message can never disagree.
 */
function formatUnit(value: number): string {
  // True when `value` would round across an integer boundary (e.g. 1.04 → "1").
  const nearBoundary = Math.abs(value - Math.round(value)) > 0.001
  const decimals = value < 10 || nearBoundary ? 1 : 0
  return value.toFixed(decimals).replace('.', ',')
}

/**
 * Format a byte count to a human-readable size string.
 * E.g. formatBytes(1572864) → "1,5 МБ"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${formatUnit(kb)} КБ`
  const mb = kb / 1024
  return `${formatUnit(mb)} МБ`
}

/**
 * Format an ISO date string to a localized date string.
 * E.g. formatDate('2026-05-16T12:00:00Z') → "16 мая 2026"
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format a 0–100 percent value to a Russian-style string.
 * E.g. formatPercent(73.5) → "73,5%", formatPercent(null) → "—"
 */
export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}

/**
 * Format a numeric score for display.
 * E.g. formatScore(7.5, 10) → "7,5 из 10", formatScore(null, 10) → "—"
 */
export function formatScore(score: number | null, totalQuestions: number): string {
  if (score === null) return '—'
  const s = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1).replace('.', ',')
  return `${s} из ${totalQuestions}`
}

/**
 * Format a timestamptz ISO string to a Russian short date+time string.
 * E.g. formatShortDateTime("2026-05-17T14:32:00Z") → "17 мая, 14:32"
 */
export function formatShortDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ru-RU', {
    day:    'numeric',
    month:  'long',
    hour:   '2-digit',
    minute: '2-digit',
  }).replace(' г.', '').replace(/(\d+\s+\w+)/, '$1,')
}
