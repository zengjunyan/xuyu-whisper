import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedSection from '@/components/FeedSection.vue'
import type { Post } from '@/lib/post'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

function makePost(id: string, patch: Partial<Post> = {}): Post {
  return {
    id,
    author: '林晚',
    createdAt: NOW - 60_000,
    content: `内容 ${id}`,
    likes: 1,
    likedByMe: false,
    ...patch,
  }
}

describe('FeedSection', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW)
  })

  it('没有动态时展示空状态', () => {
    const wrapper = mount(FeedSection, { props: { posts: [] } })

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.feed-head__count').text()).toBe('暂无内容')
    expect(wrapper.find('.empty').isVisible()).toBe(true)
    expect(wrapper.find('.empty__title').text()).toBe('这里还很安静')
  })

  it('有动态时按传入顺序渲染并显示总数', async () => {
    const wrapper = mount(FeedSection, {
      props: { posts: [makePost('a'), makePost('b', { createdAt: NOW - 120_000 })] },
    })
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('.post')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('.post__body').text()).toBe('内容 a')
    expect(cards[1].find('.post__body').text()).toBe('内容 b')
    expect(wrapper.find('.feed-head__count').text()).toBe('共 2 条')
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('点赞事件带上动态 id', async () => {
    const wrapper = mount(FeedSection, { props: { posts: [makePost('a')] } })

    await wrapper.find('.like-btn').trigger('click')
    expect(wrapper.emitted('like')).toEqual([['a']])
  })

  it('空状态按钮通知父级聚焦发布框', async () => {
    const wrapper = mount(FeedSection, { props: { posts: [] } })

    await wrapper.find('#empty-cta').trigger('click')
    expect(wrapper.emitted('compose')).toHaveLength(1)
  })

  it('高亮指定动态', () => {
    const wrapper = mount(FeedSection, {
      props: { posts: [makePost('a'), makePost('b')], highlightId: 'b' },
    })

    const cards = wrapper.findAll('.post')
    expect(cards[0].classes()).not.toContain('is-new')
    expect(cards[1].classes()).toContain('is-new')
  })
})
