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
    favorites: 0,
    favoritedByMe: false,
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

  it('默认停在「全部」，两个页签用 aria-pressed 表示选中', () => {
    const wrapper = mount(FeedSection, { props: { posts: [makePost('a')] } })

    expect(wrapper.findAll('.feed-filter__tab')).toHaveLength(2)
    expect(wrapper.find('#filter-all').text()).toBe('全部')
    expect(wrapper.find('#filter-favorites').text()).toBe('我的收藏')
    expect(wrapper.find('#filter-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('#filter-favorites').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('.feed-head__count').text()).toBe('共 1 条')
  })

  it('切到「我的收藏」只渲染已收藏的动态，计数随视图变化', async () => {
    const wrapper = mount(FeedSection, {
      props: {
        posts: [
          makePost('a', { favoritedByMe: true, favorites: 1 }),
          makePost('b'),
          makePost('c', { favoritedByMe: true, favorites: 2 }),
        ],
      },
    })

    await wrapper.find('#filter-favorites').trigger('click')

    const cards = wrapper.findAll('.post')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('.post__body').text()).toBe('内容 a')
    expect(cards[1].find('.post__body').text()).toBe('内容 c')
    // 序号按可见列表重新排序，入场动画不会因为过滤而留空档
    expect(cards[1].attributes('style')).toContain('--i: 1')
    expect(wrapper.find('.feed-head__count').text()).toBe('收藏 2 条')
    expect(wrapper.find('#filter-favorites').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('#filter-all').attributes('aria-pressed')).toBe('false')

    await wrapper.find('#filter-all').trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(3)
    expect(wrapper.find('.feed-head__count').text()).toBe('共 3 条')
  })

  it('收藏事件透传给父级', async () => {
    const wrapper = mount(FeedSection, { props: { posts: [makePost('a')] } })

    await wrapper.find('.fav-btn').trigger('click')
    expect(wrapper.emitted('favorite')).toEqual([['a']])
  })

  it('没有收藏时展示收藏空状态，「回到全部」切回全部', async () => {
    const wrapper = mount(FeedSection, {
      props: { posts: [makePost('a'), makePost('b')] },
    })

    await wrapper.find('#filter-favorites').trigger('click')

    expect(wrapper.findAll('.post')).toHaveLength(0)
    expect(wrapper.find('.feed-head__count').text()).toBe('暂无收藏')
    expect(wrapper.find('.empty').isVisible()).toBe(true)
    expect(wrapper.find('.empty__title').text()).toBe('还没有收藏')
    expect(wrapper.find('.empty__text').text()).toBe('在喜欢的絮语上点一下书签，这里就会亮起来。')
    expect(wrapper.find('#empty-cta').exists()).toBe(false)
    expect(wrapper.find('#empty-reset').text()).toBe('回到全部')

    await wrapper.find('#empty-reset').trigger('click')

    expect(wrapper.find('#filter-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.post')).toHaveLength(2)
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('「全部」视图的空状态与原来一致，不出现收藏空状态按钮', () => {
    const wrapper = mount(FeedSection, { props: { posts: [] } })

    expect(wrapper.find('.empty__title').text()).toBe('这里还很安静')
    expect(wrapper.find('.empty__text').text()).toBe('写下第一条絮语，让时间线有了起点。')
    expect(wrapper.find('#empty-cta').exists()).toBe(true)
    expect(wrapper.find('#empty-reset').exists()).toBe(false)
  })
})
