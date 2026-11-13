import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { SCENES, sceneIndexFor } from '@/lib/scenes'
import { THEME_KEY } from '@/lib/storage'
import { usePostsStore } from '@/stores/posts'
import { useThemeStore } from '@/stores/theme'
import { installApiMock, type ApiMock } from '../helpers/api-mock'
import { stubMatchMedia, type MediaQueryStub } from '../helpers/match-media'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

let wrapper: VueWrapper | null = null
let media: MediaQueryStub
let api: ApiMock

function themeMeta(): void {
  if (!document.getElementById('theme-color-meta')) {
    const meta = document.createElement('meta')
    meta.id = 'theme-color-meta'
    document.head.appendChild(meta)
  }
}

async function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  await flushPromises()
  return { wrapper, pinia, posts: usePostsStore() }
}

async function serverCount(): Promise<number> {
  return (await api.serverPosts()).length
}

describe('App 集成', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW)
    media = stubMatchMedia(false)
    themeMeta()
    api = installApiMock()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    media.restore()
    api.restore()
    vi.useRealTimers()
  })

  it('首屏渲染后端返回的示例动态、今日日期与当前壁纸', async () => {
    const app = await mountApp()
    const expectedScene = SCENES[sceneIndexFor(NOW)]

    expect(app.wrapper.findAll('.post')).toHaveLength(4)
    expect(app.wrapper.find('.feed-head__count').text()).toBe('共 4 条')
    expect(app.wrapper.find('#today-label').text()).toBe('11 月 13 日 · 星期五')
    expect(app.wrapper.find('.scene-chip__name').text()).toBe(expectedScene.name)
    expect(app.wrapper.find('.empty').exists()).toBe(false)
    expect(document.documentElement.dataset.sceneTone).toBe(expectedScene.tone)
    expect(app.posts.error).toBeNull()
  })

  it('发布后置顶展示、高亮、清空输入并写入后端', async () => {
    const app = await mountApp()
    const input = app.wrapper.find<HTMLTextAreaElement>('#composer-input')

    await input.setValue('今天的风很轻')
    await app.wrapper.find('#publish-btn').trigger('click')
    await flushPromises()
    await nextTick()

    const cards = app.wrapper.findAll('.post')
    expect(cards).toHaveLength(5)
    expect(cards[0].find('.post__body').text()).toBe('今天的风很轻')
    expect(cards[0].find('.post__author').text()).toBe('我自己')
    expect(cards[0].classes()).toContain('is-new')
    expect(app.wrapper.find('.feed-head__count').text()).toBe('共 5 条')
    expect(input.element.value).toBe('')
    expect(await serverCount()).toBe(5)
  })

  it('点赞状态在重新打开后依然保留', async () => {
    const first = await mountApp()
    const likeBtn = first.wrapper.find('.like-btn')

    expect(likeBtn.attributes('aria-pressed')).toBe('false')
    await likeBtn.trigger('click')
    await flushPromises()
    expect(likeBtn.attributes('aria-pressed')).toBe('true')
    expect(likeBtn.find('.like-btn__count').text()).toBe('13')

    wrapper?.unmount()
    wrapper = null

    const second = await mountApp()
    expect(second.wrapper.find('.like-btn').attributes('aria-pressed')).toBe('true')
    expect(second.wrapper.find('.like-btn__count').text()).toBe('13')
  })

  it('主题选择写入本地存储并在重新打开后恢复', async () => {
    const first = await mountApp()
    const toggle = first.wrapper.find('#theme-toggle')

    await toggle.trigger('click')
    await toggle.trigger('click')

    expect(document.documentElement.dataset.themeMode).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    wrapper?.unmount()
    wrapper = null

    const second = await mountApp()
    expect(useThemeStore().mode).toBe('dark')
    expect(second.wrapper.find('#theme-toggle').attributes('aria-label')).toBe(
      '明暗主题：深色，点击切换为跟随系统',
    )
  })

  it('空状态下的按钮会把焦点带回发布框', async () => {
    const app = await mountApp()
    app.posts.posts = []
    await nextTick()

    expect(app.wrapper.find('.empty').exists()).toBe(true)
    await app.wrapper.find('#empty-cta').trigger('click')

    expect(document.activeElement).toBe(app.wrapper.find('#composer-input').element)
  })

  it('后端不可用时展示错误提示，页面不白屏', async () => {
    api.failNextNetwork()
    const app = await mountApp()

    expect(app.posts.error).toContain('无法连接')
    expect(app.wrapper.findAll('.post')).toHaveLength(0)
    expect(app.wrapper.find('.empty').exists()).toBe(true)
  })

  it('换背景后角标名称同步更新', async () => {
    const app = await mountApp()
    const expected = SCENES[(sceneIndexFor(NOW) + 1) % SCENES.length]

    await app.wrapper.find('#scene-next').trigger('click')
    await nextTick()

    expect(app.wrapper.find('.scene-chip__name').text()).toBe(expected.name)
    expect(app.wrapper.findAll('.scene-layer')).toHaveLength(2)
  })
})
