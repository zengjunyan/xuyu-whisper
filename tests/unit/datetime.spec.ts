import { describe, expect, it } from 'vitest'
import { formatRelative, formatToday } from '@/lib/datetime'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

describe('formatRelative', () => {
  it('把 1 分钟以内的时间显示为「刚刚」', () => {
    expect(formatRelative(NOW, NOW)).toBe('刚刚')
    expect(formatRelative(NOW - 59_000, NOW)).toBe('刚刚')
  })

  it('把未来时间与非数字显示为「刚刚」', () => {
    expect(formatRelative(NOW + 10_000, NOW)).toBe('刚刚')
    expect(formatRelative(Number.NaN, NOW)).toBe('刚刚')
  })

  it('按分钟、小时、天递进', () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe('1 分钟前')
    expect(formatRelative(NOW - 59 * 60_000, NOW)).toBe('59 分钟前')
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe('1 小时前')
    expect(formatRelative(NOW - 23 * 3_600_000, NOW)).toBe('23 小时前')
    expect(formatRelative(NOW - 24 * 3_600_000, NOW)).toBe('1 天前')
    expect(formatRelative(NOW - 6 * 86_400_000, NOW)).toBe('6 天前')
  })

  it('超过 7 天显示补零的日期', () => {
    expect(formatRelative(new Date(2026, 10, 1, 9, 30).getTime(), NOW)).toBe('2026-11-01')
    expect(formatRelative(new Date(2025, 0, 5, 9, 30).getTime(), NOW)).toBe('2025-01-05')
  })
})

describe('formatToday', () => {
  it('输出中文日期与星期', () => {
    expect(formatToday(new Date(2026, 10, 13))).toBe('11 月 13 日 · 星期五')
    expect(formatToday(new Date(2026, 0, 4))).toBe('1 月 4 日 · 星期日')
  })
})
