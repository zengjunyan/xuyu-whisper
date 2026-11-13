import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PostCard from '@/components/PostCard.vue'
import { avatarGradient, type Post } from '@/lib/post'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

function makePost(patch: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '林晚',
    createdAt: NOW - 5 * 60_000,
    content: '傍晚收衣服的时候，风里有一点桂花味。',
    likes: 12,
    likedByMe: false,
    ...patch,
  }
}

function mountCard(post: Post, options: { highlight?: boolean } = {}) {
  return mount(PostCard, {
    props: { post, index: 0, now: NOW, highlight: options.highlight ?? false },
  })
}

describe('PostCard', () => {
  it('渲染作者、头像首字、渐变与正文', () => {
    const wrapper = mountCard(makePost())
    const [from, to] = avatarGradient('林晚')

    expect(wrapper.find('.post__author').text()).toBe('林晚')
    expect(wrapper.find('.post__avatar').text()).toBe('林')
    expect(wrapper.find<HTMLElement>('.post__avatar').element.style.backgroundImage).toContain(from)
    expect(wrapper.find<HTMLElement>('.post__avatar').element.style.backgroundImage).toContain(to)
    expect(wrapper.find('.post__body').text()).toBe('傍晚收衣服的时候，风里有一点桂花味。')
  })

  it('展示相对时间与完整时间', () => {
    const wrapper = mountCard(makePost())
    const time = wrapper.find('.post__time')

    expect(time.text()).toBe('5 分钟前')
    expect(time.attributes('datetime')).toBe(new Date(NOW - 5 * 60_000).toISOString())
    expect(time.attributes('title')).toBe(new Date(NOW - 5 * 60_000).toLocaleString('zh-CN'))
  })

  it('点赞按钮反映状态，点击时向父级发出 like 事件', async () => {
    const unliked = mountCard(makePost())
    expect(unliked.find('.like-btn').attributes('aria-pressed')).toBe('false')
    expect(unliked.find('.like-btn__count').text()).toBe('12')
    expect(unliked.find('.like-btn').attributes('aria-label')).toBe('点赞，林晚')

    await unliked.find('.like-btn').trigger('click')
    expect(unliked.emitted('like')).toEqual([['p1']])

    const liked = mountCard(makePost({ likedByMe: true, likes: 13 }))
    expect(liked.find('.like-btn').attributes('aria-pressed')).toBe('true')
    expect(liked.find('.like-btn').attributes('aria-label')).toBe('取消点赞，林晚')
    expect(liked.find('.like-btn__count').text()).toBe('13')
  })

  it('新发布的卡片带高亮类，并带入场序号', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost(), index: 3, now: NOW, highlight: true },
    })

    expect(wrapper.classes()).toContain('post')
    expect(wrapper.classes()).toContain('is-new')
    expect(wrapper.attributes('style')).toContain('--i: 3')
  })

  it('短正文没有展开按钮，长正文可以展开与收起', async () => {
    const short = mountCard(makePost())
    expect(short.find('.expand-btn').exists()).toBe(false)

    const long = mountCard(
      makePost({
        content:
          '凌晨写完最后一页，关灯之前听见楼下有人推着自行车走过，链条声很轻。城市安静下来的时候，才听得见它呼吸。'.repeat(
            3,
          ),
      }),
    )
    const body = long.find('.post__body')
    const button = long.find('.expand-btn')

    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('展开全文')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(body.classes()).not.toContain('is-expanded')

    await button.trigger('click')
    expect(body.classes()).toContain('is-expanded')
    expect(button.text()).toBe('收起')
    expect(button.attributes('aria-expanded')).toBe('true')

    await button.trigger('click')
    expect(body.classes()).not.toContain('is-expanded')
    expect(button.text()).toBe('展开全文')
  })
})
