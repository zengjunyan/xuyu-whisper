import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_THEME_KEY, THEME_KEY } from '@/lib/storage'
import { useThemeStore } from '@/stores/theme'
import { stubMatchMedia, type MediaQueryStub } from '../helpers/match-media'

let media: MediaQueryStub

function themeMeta(): HTMLMetaElement {
  let meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.id = 'theme-color-meta'
    document.head.appendChild(meta)
  }
  return meta
}

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    media = stubMatchMedia(false)
    themeMeta()
  })

  afterEach(() => {
    media.restore()
  })

  it('默认跟随系统，并解析出浅色主题', () => {
    const theme = useThemeStore()
    theme.init()

    expect(theme.mode).toBe('system')
    expect(theme.resolved).toBe('light')
    expect(theme.label).toBe('跟随系统')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.themeMode).toBe('system')
    expect(themeMeta().content).toBe('#FAF6EF')
  })

  it('系统为深色时解析为深色', () => {
    media.setDark(true)
    const theme = useThemeStore()
    theme.init()

    expect(theme.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeMeta().content).toBe('#14110F')
  })

  it('读取已保存的偏好，非法值回退到 system', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    const theme = useThemeStore()
    theme.init()
    expect(theme.mode).toBe('dark')
    expect(theme.resolved).toBe('dark')

    setActivePinia(createPinia())
    localStorage.setItem(THEME_KEY, 'neon')
    const fallback = useThemeStore()
    fallback.init()
    expect(fallback.mode).toBe('system')
  })

  it('清理旧版本遗留的主题键', () => {
    localStorage.setItem(LEGACY_THEME_KEY, 'dark')
    const theme = useThemeStore()
    theme.init()

    expect(localStorage.getItem(LEGACY_THEME_KEY)).toBeNull()
    expect(theme.mode).toBe('system')
  })

  it('按 system → light → dark 循环并持久化', () => {
    const theme = useThemeStore()
    theme.init()

    expect(theme.nextMode).toBe('light')
    theme.cycle()
    expect(theme.mode).toBe('light')
    expect(theme.resolved).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')

    theme.cycle()
    expect(theme.mode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    theme.cycle()
    expect(theme.mode).toBe('system')
    expect(localStorage.getItem(THEME_KEY)).toBe('system')
  })

  it('跟随系统时随系统变化，手动模式下不跟随', () => {
    const theme = useThemeStore()
    theme.init()
    expect(media.listenerCount).toBe(1)

    media.setDark(true)
    expect(theme.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    theme.setMode('light')
    media.setDark(false)
    media.setDark(true)
    expect(theme.resolved).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('重复 init 不会重复注册监听，dispose 会移除', () => {
    const theme = useThemeStore()
    theme.init()
    theme.init()
    expect(media.listenerCount).toBe(1)

    theme.dispose()
    expect(media.listenerCount).toBe(0)

    theme.init()
    expect(media.listenerCount).toBe(1)
  })

  it('提供可读的按钮文案', () => {
    const theme = useThemeStore()
    theme.init()

    expect(theme.toggleLabel).toBe('明暗主题：跟随系统，点击切换为浅色')
    theme.cycle()
    expect(theme.toggleLabel).toBe('明暗主题：浅色，点击切换为深色')
  })

  it('写偏好失败时不抛异常', () => {
    const theme = useThemeStore()
    theme.init()

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() => theme.cycle()).not.toThrow()
    expect(theme.mode).toBe('light')

    setItem.mockRestore()
  })
})
