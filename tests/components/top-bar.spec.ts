import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '@/components/TopBar.vue'
import { THEME_KEY } from '@/lib/storage'
import { SCENES } from '@/lib/scenes'
import { useSceneStore } from '@/stores/scene'
import { useThemeStore } from '@/stores/theme'
import { useToastStore } from '@/stores/toast'
import { stubMatchMedia, type MediaQueryStub } from '../helpers/match-media'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

let pinia: Pinia
let media: MediaQueryStub

describe('TopBar', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    media = stubMatchMedia(false)
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    media.restore()
    vi.useRealTimers()
  })

  it('渲染品牌与两个图标按钮', () => {
    const theme = useThemeStore()
    theme.init()
    const wrapper = mount(TopBar, { global: { plugins: [pinia] } })

    expect(wrapper.find('.brand__cn').text()).toBe('絮语')
    expect(wrapper.find('.brand__en').text()).toBe('Whisper')
    expect(wrapper.find('#theme-toggle').exists()).toBe(true)
    expect(wrapper.find('#scene-next').exists()).toBe(true)
  })

  it('主题按钮按 跟随系统 → 浅色 → 深色 循环并提示', async () => {
    const theme = useThemeStore()
    theme.init()
    const toast = useToastStore()
    const wrapper = mount(TopBar, { global: { plugins: [pinia] } })
    const button = wrapper.find('#theme-toggle')

    expect(button.attributes('aria-label')).toBe('明暗主题：跟随系统，点击切换为浅色')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('title')).toBe('明暗主题：跟随系统（点击切换）')
    expect(button.find('.theme-dot').exists()).toBe(true)

    await button.trigger('click')
    expect(theme.mode).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.documentElement.dataset.themeMode).toBe('light')
    expect(toast.message).toBe('已切换为浅色模式')

    await button.trigger('click')
    expect(theme.mode).toBe('dark')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(toast.message).toBe('已切换为深色模式')

    await button.trigger('click')
    expect(theme.mode).toBe('system')
    expect(toast.message).toBe('已跟随系统 · 浅色')
  })

  it('换背景按钮顺延到下一张并提示名称', async () => {
    const scene = useSceneStore()
    scene.init(NOW)
    const toast = useToastStore()
    const before = scene.index

    const wrapper = mount(TopBar, { global: { plugins: [pinia] } })
    await wrapper.find('#scene-next').trigger('click')

    const expected = SCENES[(before + 1) % SCENES.length]
    expect(scene.index).toBe((before + 1) % SCENES.length)
    expect(toast.message).toBe(`换了一张 · ${expected.name}`)
  })
})
