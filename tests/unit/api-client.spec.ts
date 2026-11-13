import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPost, fetchPosts, setPostFavorite, setPostLike } from '@/lib/api'
import type { Post } from '@/lib/post'
import { installApiMock, type ApiMock } from '../helpers/api-mock'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

let api: ApiMock

/** 取出请求失败时抛出的错误，便于断言 status / code */
async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (reason) {
    return reason as ApiError
  }
  throw new Error('预期请求失败，但实际成功返回了')
}

describe('api client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    api = installApiMock()
  })

  afterEach(() => {
    api.restore()
    vi.useRealTimers()
  })

  it('fetchPosts 请求同源 /api/posts 并返回动态列表', async () => {
    const posts = await fetchPosts()

    expect(posts).toHaveLength(4)
    expect(posts[0].id).toBe('seed-linwan')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/posts')
  })

  it('fetchPosts 逐条清洗，丢弃非法条目', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: 'ok', author: ' 林晚 ', content: ' 桂花开了 ', createdAt: NOW, likes: 2 },
            { id: 'bad', content: '   ' },
            null,
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const posts = await fetchPosts()

    expect(posts).toHaveLength(1)
    expect(posts[0].author).toBe('林晚')
    expect(posts[0].content).toBe('桂花开了')
  })

  it('fetchPosts 遇到非数组响应时返回空列表而不是崩溃', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ hello: 'world' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    await expect(fetchPosts()).resolves.toEqual([])
  })

  it('createPost 发送 JSON 并返回服务端创建的资源', async () => {
    const post = await createPost({ content: '  今天的风很轻  ' })

    expect(post.content).toBe('今天的风很轻')
    expect(post.author).toBe('我自己')
    expect(post.createdAt).toBe(NOW)
    expect(post.id.startsWith('p_')).toBe(true)
    expect(await api.serverPosts()).toHaveLength(5)

    // 清洗规则统一放在服务端，客户端原样转发
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ content: '  今天的风很轻  ' })
  })

  it('createPost 遇到 400 时抛出带服务端文案的 ApiError', async () => {
    await expect(createPost({ content: '' })).rejects.toBeInstanceOf(ApiError)
    await expect(createPost({ content: '' })).rejects.toThrow('内容不能为空')

    const error = await rejectionOf(createPost({ content: '   ' }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('INVALID_CONTENT')
  })

  it('setPostLike 切换点赞状态', async () => {
    const posts = await fetchPosts()
    const target = posts[0]

    const liked = await setPostLike(target.id, true)
    expect(liked.likedByMe).toBe(true)
    expect(liked.likes).toBe(target.likes + 1)

    const unliked = await setPostLike(target.id, false)
    expect(unliked.likedByMe).toBe(false)
    expect(unliked.likes).toBe(target.likes)
  })

  it('setPostLike 未知 id 抛出 404 ApiError', async () => {
    const error = await rejectionOf(setPostLike('missing', true))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('断网时抛出 NETWORK 错误并给出可展示的中文提示', async () => {
    api.failNextNetwork()

    const error = await rejectionOf(fetchPosts())

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('NETWORK')
    expect(error.message).toContain('无法连接')
  })

  it('服务端返回非 JSON 时使用兜底文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502</html>', { status: 502 })),
    )

    const error = await rejectionOf(fetchPosts())

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.message.length).toBeGreaterThan(0)
  })

  it('ApiError 保留 status 与 code，便于上层分流', () => {
    const error = new ApiError('内容不能为空', { status: 400, code: 'INVALID_CONTENT' })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(400)
    expect(error.code).toBe('INVALID_CONTENT')
  })

  it('创建成功后返回的对象符合 Post 结构', async () => {
    const post: Post = await createPost({ content: '结构校验', author: '林晚' })

    expect(Object.keys(post).sort()).toEqual([
      'author',
      'content',
      'createdAt',
      'favoritedByMe',
      'favorites',
      'id',
      'likedByMe',
      'likes',
    ])
    expect(post.author).toBe('林晚')
  })

  it('setPostFavorite 用 PUT 命中 /favorite 并原样发送 favorited', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'p_1',
            author: '林晚',
            createdAt: NOW,
            content: '收藏一下',
            likes: 3,
            likedByMe: false,
            favorites: 5,
            favoritedByMe: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const post = await setPostFavorite('p 1/2', true)

    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/posts/p%201%2F2/favorite')
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({ favorited: true })
    expect(post.favoritedByMe).toBe(true)
    expect(post.favorites).toBe(5)
  })

  it('setPostFavorite 取消收藏时发送 favorited: false', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'p_1',
            author: '林晚',
            createdAt: NOW,
            content: '取消收藏',
            likes: 0,
            likedByMe: false,
            favorites: 0,
            favoritedByMe: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const post = await setPostFavorite('p_1', false)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ favorited: false })
    expect(post.favoritedByMe).toBe(false)
  })

  it('setPostFavorite 的 404 映射为 NOT_FOUND 的 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '这条絮语不见了' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )

    const error = await rejectionOf(setPostFavorite('missing', true))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('这条絮语不见了')
  })
})
