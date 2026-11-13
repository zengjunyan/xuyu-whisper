import { vi } from 'vitest'

export interface MediaQueryStub {
  /** 修改偏好并触发已注册的 change 回调 */
  setDark(dark: boolean): void
  /** 当前是否已注册监听 */
  readonly listenerCount: number
  restore(): void
}

/**
 * jsdom 没有实现 matchMedia，测试里用一个可控的实现替换。
 */
export function stubMatchMedia(initialDark = false): MediaQueryStub {
  let dark = initialDark
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const list: MediaQueryList = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void)
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void)
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => list),
  )

  return {
    setDark(value: boolean) {
      dark = value
      listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
    },
    get listenerCount() {
      return listeners.size
    },
    restore() {
      listeners.clear()
      vi.unstubAllGlobals()
    },
  }
}
