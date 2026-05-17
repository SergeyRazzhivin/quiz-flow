// format.test.ts
// Unit tests for the human-readable formatters in format.ts.

import { describe, it, expect } from 'vitest'
import { formatBytes, formatDuration } from './format'

describe('formatBytes', () => {
  it('formats sub-kilobyte sizes in bytes', () => {
    expect(formatBytes(512)).toBe('512 Б')
  })

  it('formats kilobyte sizes', () => {
    expect(formatBytes(1024)).toBe('1,0 КБ')
    expect(formatBytes(1536)).toBe('1,5 КБ')
  })

  it('formats an exact 1 MB file as "1,0 МБ"', () => {
    expect(formatBytes(1024 * 1024)).toBe('1,0 МБ')
  })

  it('IN-03: a file just over 1 MB never rounds down to a contradictory "1 МБ"', () => {
    // 1.04 MB — must not display as "1 МБ" while being rejected for being "больше 1 МБ".
    const label = formatBytes(Math.round(1.04 * 1024 * 1024))
    expect(label).not.toBe('1 МБ')
    expect(label).toBe('1,0 МБ')
  })

  it('IN-03: a sub-1-MB file does not round up to "1 МБ"', () => {
    const label = formatBytes(1_048_000) // ~0.999 MB
    expect(label).not.toBe('1 МБ')
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes, and mixed durations', () => {
    expect(formatDuration(45)).toBe('45 сек')
    expect(formatDuration(600)).toBe('10 мин')
    expect(formatDuration(125)).toBe('2 мин 5 сек')
  })
})
