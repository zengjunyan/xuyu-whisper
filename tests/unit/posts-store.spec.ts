import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, type Post } from '@/lib/post'
import { PUBLISH_COOLDOWN, usePostsStore } from '@/stores/posts'
import { installApiMock, type ApiMock } from '../helpers/api-mock'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

let api: ApiMock

function newStore() {
  setActivePinia(createPinia())
  return usePostsStore()
}

describe('posts store（后端 REST API）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    api = installApiMock()
  })

  afterEach(() => {
    api.restore()
    vi.useRealTimers()
  })

  it('load 从服务端取回示例动态，并按时间倒序', async () => {
    const store = newStore()

    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)

    await store.load()

    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.posts).toHaveLength(4)
    expect(store.sortedPosts.map((post) => post.id)).toEqual([
      'seed-linwan',
      'seed-aju',
      'seed-shen',
      'seed-nanzhi',
    ])
  })

  it('并发调用 load 只发一次请求', async () => {
    const store = newStore()

    await Promise.all([store.load(), store.load()])

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(store.posts).toHaveLength(4)
  })

  it('服务端不可用时记录错误，不抛异常', async () => {
    api.failNextNetwork()
    const store = newStore()

    await expect(store.load()).resolves.toBeUndefined()

    expect(store.error).toContain('无法连接')
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.posts).toEqual([])
  })

  it('发布成功后置顶展示，并由服务端持久化', async () => {
    const store = newStore()
    await store.load()

    const post = await store.publish('  今天风很轻  ')

    expect(post).not.toBeNull()
    expect(post?.content).toBe('今天风很轻')
    expect(post?.author).toBe(ME)
    expect(post?.createdAt).toBe(NOW)
    expect(post?.likes).toBe(0)
    expect(post?.likedByMe).toBe(false)
    expect(post?.id.startsWith('p_')).toBe(true)

    expect(store.posts).toHaveLength(5)
    expect(store.sortedPosts[0].id).toBe(post?.id)

    const serverPosts = (await api.serverPosts()) as Post[]
    expect(serverPosts).toHaveLength(5)
    expect(serverPosts[0].id).toBe(post?.id)
  })

  it('拒绝空内容，且不发出请求', async () => {
    const store = newStore()
    await store.load()
    const calls = vi.mocked(fetch).mock.calls.length

    await expect(store.publish('   \n  ')).resolves.toBeNull()

    expect(store.posts).toHaveLength(4)
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls)
    expect(store.error).toBe('内容不能为空')
  })

  it('超长正文按 280 字截断后再提交', async () => {
    const store = newStore()
    await store.load()

    const post = await store.publish('絮'.repeat(400))

    expect(post?.content).toHaveLength(280)
  })

  it('服务端拒绝发布时返回 null 并暴露错误文案', async () => {
    const store = newStore()
    await store.load()

    api.failNextResponse(500, 'INTERNAL')
    const post = await store.publish('这条会失败')

    expect(post).toBeNull()
    expect(store.posts).toHaveLength(4)
    expect(store.error).toBeTruthy()
  })

  it('发布后的 320ms 内忽略重复提交，之后恢复', async () => {
    const store = newStore()
    await store.load()

    const first = await store.publish('第一条')
    expect(first).not.toBeNull()
    expect(store.submitting).toBe(true)

    await expect(store.publish('第二条')).resolves.toBeNull()
    expect(store.posts).toHaveLength(5)

    vi.advanceTimersByTime(PUBLISH_COOLDOWN)
    expect(store.submitting).toBe(false)

    await expect(store.publish('第二条')).resolves.not.toBeNull()
    expect(store.posts).toHaveLength(6)
  })

  it('点赞立即生效（乐观更新）并同步到服务端', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    const before = target.likes

    const pending = store.toggleLike(target.id)
    expect(target.likedByMe).toBe(true)
    expect(target.likes).toBe(before + 1)

    const liked = await pending
    expect(liked?.likedByMe).toBe(true)
    expect(liked?.likes).toBe(before + 1)

    const serverPosts = (await api.serverPosts()) as Post[]
    expect(serverPosts.find((post) => post.id === target.id)?.likes).toBe(before + 1)

    const unliked = await store.toggleLike(target.id)
    expect(unliked?.likedByMe).toBe(false)
    expect(unliked?.likes).toBe(before)
  })

  it('点赞失败时回滚到原状态', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    const before = { likes: target.likes, likedByMe: target.likedByMe }

    api.failNextNetwork()
    const result = await store.toggleLike(target.id)

    expect(result).toBeNull()
    expect(target.likes).toBe(before.likes)
    expect(target.likedByMe).toBe(before.likedByMe)
    expect(store.error).toContain('无法连接')
  })

  it('未知 id 返回 null', async () => {
    const store = newStore()
    await store.load()

    await expect(store.toggleLike('missing')).resolves.toBeNull()
  })

  it('收藏立即生效（乐观更新）并同步到服务端', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    const before = { favorites: target.favorites, favoritedByMe: target.favoritedByMe }

    const pending = store.toggleFavorite(target.id)
    expect(target.favoritedByMe).toBe(true)
    expect(target.favorites).toBe(before.favorites + 1)

    const saved = await pending
    expect(saved?.favoritedByMe).toBe(true)
    expect(saved?.favorites).toBe(before.favorites + 1)

    const serverPosts = (await api.serverPosts()) as Post[]
    const serverPost = serverPosts.find((post) => post.id === target.id)
    expect(serverPost?.favorites).toBe(before.favorites + 1)
    expect(serverPost?.favoritedByMe).toBe(true)

    const removed = await store.toggleFavorite(target.id)
    expect(removed?.favoritedByMe).toBe(false)
    expect(removed?.favorites).toBe(before.favorites)
  })

  it('取消收藏时计数不会掉到负数', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    target.favorites = 0
    target.favoritedByMe = true

    const pending = store.toggleFavorite(target.id)
    expect(target.favorites).toBe(0)

    await pending.catch(() => undefined)
  })

  it('收藏失败时回滚到原状态', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    const before = { favorites: target.favorites, favoritedByMe: target.favoritedByMe }

    api.failNextNetwork()
    const result = await store.toggleFavorite(target.id)

    expect(result).toBeNull()
    expect(target.favorites).toBe(before.favorites)
    expect(target.favoritedByMe).toBe(before.favoritedByMe)
    expect(store.error).toContain('无法连接')
  })

  it('收藏未知 id 返回 null 且不报错', async () => {
    const store = newStore()
    await store.load()

    await expect(store.toggleFavorite('missing')).resolves.toBeNull()
    expect(store.error).toBeNull()
  })

  it('点赞与收藏互不影响', async () => {
    const store = newStore()
    await store.load()
    const target = store.sortedPosts[0]
    const likesBefore = target.likes
    const favoritesBefore = target.favorites

    await store.toggleFavorite(target.id)
    expect(target.likes).toBe(likesBefore)
    expect(target.likedByMe).toBe(false)

    await store.toggleLike(target.id)
    expect(target.favoritedByMe).toBe(true)
    expect(target.favorites).toBe(favoritesBefore + 1)
  })

  it('统计文案随数量变化', async () => {
    const store = newStore()
    expect(store.countLabel).toBe('暂无内容')

    await store.load()
    expect(store.total).toBe(4)
    expect(store.countLabel).toBe('共 4 条')
    expect(store.isEmpty).toBe(false)

    store.posts = []
    expect(store.countLabel).toBe('暂无内容')
    expect(store.isEmpty).toBe(true)
  })
})
