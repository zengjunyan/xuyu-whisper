const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

/**
 * 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD
 * 非法或未来时间一律显示「刚刚」，避免出现负数的尴尬文案。
 */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  if (!Number.isFinite(timestamp) || diff < 0) return '刚刚'
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`

  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 引导区的日期标题：11 月 13 日 · 星期五 */
export function formatToday(date: Date = new Date()): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${WEEKDAYS[date.getDay()]}`
}

/** 悬浮在时间上的完整时间 */
export function formatFullTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}
