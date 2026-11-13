export type SceneTone = 'light' | 'dark'

export interface Scene {
  file: string
  name: string
  tone: SceneTone
}

export const HOUR = 3_600_000

/** 本地壁纸：顺序即整点轮换顺序 */
export const SCENES: readonly Scene[] = [
  { file: 'assets/bg-01.jpg', name: '晨雾', tone: 'light' },
  { file: 'assets/bg-02.jpg', name: '午后', tone: 'light' },
  { file: 'assets/bg-03.jpg', name: '秋光', tone: 'light' },
  { file: 'assets/bg-04.jpg', name: '灯下', tone: 'dark' },
  { file: 'assets/bg-05.jpg', name: '归海', tone: 'light' },
  { file: 'assets/bg-06.jpg', name: '陶野', tone: 'light' },
  { file: 'assets/bg-07.jpg', name: '薄暮', tone: 'light' },
  { file: 'assets/bg-08.jpg', name: '夜窗', tone: 'dark' },
]

/** 当前小时序号 */
export function hourSlot(timestamp: number): number {
  return Math.floor(timestamp / HOUR)
}

/** 把任意索引规范到 0..len-1 */
export function normalizeIndex(index: number): number {
  const length = SCENES.length
  return ((Math.trunc(index) % length) + length) % length
}

/** 整点排期：同一小时永远看到同一张 */
export function sceneIndexFor(timestamp: number): number {
  return normalizeIndex(hourSlot(timestamp))
}

export function sceneAt(index: number): Scene {
  return SCENES[normalizeIndex(index)]
}
