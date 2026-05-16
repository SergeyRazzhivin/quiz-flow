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
