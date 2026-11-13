import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ComposerCard from '@/components/ComposerCard.vue'
import { MAX_LEN } from '@/lib/post'
import { usePostsStore } from '@/stores/posts'
import { useToastStore } from '@/stores/toast'
import { installApiMock, type ApiMock } from '../helpers/api-mock'

let pinia: Pinia
let api: ApiMock

function mountComposer() {
  const wrapper = mount(ComposerCard, { global: { plugins: [pinia] } })
  return {
    wrapper,
    store: usePostsStore(),
    toast: useToastStore(),
    input: wrapper.find<HTMLTextAreaElement>('#composer-input'),
    button: wrapper.find<HTMLButtonElement>('#publish-btn'),
  }
}

describe('ComposerCard', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    api = installApiMock()
  })

  afterEach(() => {
    api.restore()
  })

  it('初始剩余 280 字，发布按钮禁用', () => {
    const { wrapper, input, button } = mountComposer()

    expect(wrapper.find('#char-count').text()).toBe(String(MAX_LEN))
    expect(input.attributes('maxlength')).toBe(String(MAX_LEN))
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.find('#composer-tip').text()).toBe('按 Ctrl / ⌘ + Enter 也可以快速发布')
  })

  it('输入后实时更新剩余字数并启用按钮', async () => {
    const { wrapper, input, button } = mountComposer()

    await input.setValue('你好')

    expect(wrapper.find('#char-count').text()).toBe(String(MAX_LEN - 2))
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('#meter').classes()).not.toContain('is-warn')
  })

  it('接近上限与到达上限时给出提示与样式', async () => {
    const { wrapper, input } = mountComposer()

    await input.setValue('絮'.repeat(MAX_LEN - 40))
    expect(wrapper.find('#meter').classes()).toContain('is-warn')
    expect(wrapper.find('#composer-tip').text()).toBe('还能写下 40 字，慢慢来')

    await input.setValue('絮'.repeat(MAX_LEN))
    expect(wrapper.find('#meter').classes()).toContain('is-limit')
    expect(wrapper.find('#char-count').text()).toBe('0')
  })

  it('纯空白内容不能发布', async () => {
    const { input, button, store } = mountComposer()

    await input.setValue('   \n  ')

    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    await flushPromises()
    expect(store.posts).toHaveLength(0)
  })

  it('点击发布后清空输入框、写入 store 并发出事件', async () => {
    const { wrapper, input, button, store, toast } = mountComposer()
    await input.setValue('  今天风很轻  ')
    await button.trigger('click')
    await flushPromises()

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].content).toBe('今天风很轻')
    expect(input.element.value).toBe('')
    expect(wrapper.find('#char-count').text()).toBe(String(MAX_LEN))
    expect(wrapper.emitted('published')).toHaveLength(1)
    expect(wrapper.emitted('published')?.[0][0]).toMatchObject({ content: '今天风很轻' })
    expect(toast.message).toBe('已发布，静候回响')
    expect(toast.visible).toBe(true)
    // 服务端首次访问会播种 4 条示例动态，这里确认新动态确实落到了后端
    expect(await api.serverPosts()).toHaveLength(5)
  })

  it('服务端拒绝时保留草稿并提示错误', async () => {
    const { input, button, store, toast } = mountComposer()
    await input.setValue('这条会失败')
    api.failNextResponse(500, 'INTERNAL')

    await button.trigger('click')
    await flushPromises()

    expect(store.posts).toHaveLength(0)
    expect(input.element.value).toBe('这条会失败')
    expect(toast.visible).toBe(true)
    expect(toast.message).toBeTruthy()
  })

  it('Ctrl + Enter 快速发布，单独 Enter 不发布', async () => {
    vi.useFakeTimers()
    const { input, store } = mountComposer()
    await input.setValue('回车试试')

    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(store.posts).toHaveLength(0)

    await input.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()
    expect(store.posts).toHaveLength(1)

    vi.advanceTimersByTime(320)

    await input.setValue('再来一条')
    await input.trigger('keydown', { key: 'Enter', metaKey: true })
    await flushPromises()
    expect(store.posts).toHaveLength(2)
    vi.useRealTimers()
  })

  it('提交后 320ms 内按钮保持禁用，避免重复发布', async () => {
    const { input, button, store } = mountComposer()
    await input.setValue('只发一次')
    await button.trigger('click')
    await flushPromises()

    expect(store.posts).toHaveLength(1)
    expect(store.submitting).toBe(true)
    expect(button.attributes('disabled')).toBeDefined()
  })
})
