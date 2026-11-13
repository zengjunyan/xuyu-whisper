// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LEN, ME, type Post } from '@/lib/post'
import { createApp } from '../../server/app'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

interface ApiError {
  error: {
    code: string
    message: string
  }
}

/** 每个用例一个独立 app，验证内存仓库互不共享 */
function newApp() {
  const app = createApp()
  return {
    app,
    list: async (): Promise<Post[]> => {
      const response = await app.request('/api/posts')
      return (await response.json()) as Post[]
    },
    create: (body: unknown) =>
      app.request('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    like: (id: string, body: unknown) =>
      app.request(`/api/posts/${id}/like`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    favorite: (id: string, body: unknown) =>
      app.request(`/api/posts/${id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/health', () => {
  it('返回 ok', async () => {
    const { app } = newApp()
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('GET /api/posts', () => {
  it('首次访问播种 4 条示例动态，并按时间倒序', async () => {
    const { list } = newApp()
    const posts = await list()

    expect(posts).toHaveLength(4)
    expect(posts.map((post) => post.id)).toEqual([
      'seed-linwan',
      'seed-aju',
      'seed-shen',
      'seed-nanzhi',
    ])
    const times = posts.map((post) => post.createdAt)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('重复请求不会重复播种', async () => {
    const { list } = newApp()

    const first = await list()
    const second = await list()

    expect(second).toHaveLength(4)
    expect(second.map((post) => post.id)).toEqual(first.map((post) => post.id))
  })

  it('返回的每条动态字段与前端模型一致', async () => {
    const { list } = newApp()
    const [post] = await list()

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
  })

  it('示例动态带收藏数且初始未收藏', async () => {
    const { list } = newApp()
    const posts = await list()

    expect(posts.find((post) => post.id === 'seed-linwan')?.favorites).toBe(4)
    expect(posts.find((post) => post.id === 'seed-nanzhi')?.favorites).toBe(9)
    expect(posts.every((post) => post.favoritedByMe === false)).toBe(true)
  })

  it('一次 GET 返回的数组被修改后不影响仓库', async () => {
    const { list } = newApp()
    const posts = await list()
    posts[0].likes = 999
    posts.pop()

    const again = await list()
    expect(again).toHaveLength(4)
    expect(again[0].likes).not.toBe(999)
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201 与完整资源', async () => {
    const { create, list } = newApp()
    const response = await create({ content: '今天的风很轻' })

    expect(response.status).toBe(201)
    const post = (await response.json()) as Post
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
    expect(post.content).toBe('今天的风很轻')
    expect(post.author).toBe(ME)
    expect(post.likes).toBe(0)
    expect(post.likedByMe).toBe(false)
    expect(post.favorites).toBe(0)
    expect(post.favoritedByMe).toBe(false)
    expect(post.createdAt).toBe(NOW)
    expect(post.id.startsWith('p_')).toBe(true)

    const posts = await list()
    expect(posts).toHaveLength(5)
    expect(posts[0].id).toBe(post.id)
  })

  it('保留自定义作者', async () => {
    const { create } = newApp()
    const response = await create({ content: '路过', author: ' 林晚 ' })
    const post = (await response.json()) as Post

    expect(post.author).toBe('林晚')
  })

  it('去掉正文首尾空白', async () => {
    const { create } = newApp()
    const response = await create({ content: '  今天风很轻  ' })
    const post = (await response.json()) as Post

    expect(post.content).toBe('今天风很轻')
  })

  it('超长正文截断到 280 字', async () => {
    const { create } = newApp()
    const response = await create({ content: '絮'.repeat(400) })
    const post = (await response.json()) as Post

    expect(post.content).toHaveLength(MAX_LEN)
  })

  it.each([
    ['空字符串', { content: '' }],
    ['纯空白', { content: '   \n  ' }],
    ['非字符串', { content: 42 }],
    ['缺少 content', { author: '林晚' }],
  ])('%s 返回 400 INVALID_CONTENT', async (_name, body) => {
    const { app, list } = newApp()
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(400)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('INVALID_CONTENT')
    expect(payload.error.message.length).toBeGreaterThan(0)
    expect(await list()).toHaveLength(4)
  })

  it.each([
    ['非法 JSON', '{'],
    ['空请求体', ''],
    ['数组', '[]'],
    ['null', 'null'],
  ])('%s 返回 400 INVALID_BODY', async (_name, body) => {
    const { create } = newApp()
    const response = await create(body)

    expect(response.status).toBe(400)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('INVALID_BODY')
  })
})

describe('PUT /api/posts/:id/like', () => {
  it('点赞后计数加一且标记已赞', async () => {
    const { app, like } = newApp()
    const before = (await (await app.request('/api/posts')).json()) as Post[]
    const target = before[0]

    const response = await like(target.id, { liked: true })

    expect(response.status).toBe(200)
    const post = (await response.json()) as Post
    expect(post.id).toBe(target.id)
    expect(post.likedByMe).toBe(true)
    expect(post.likes).toBe(target.likes + 1)
  })

  it('重复点赞保持幂等', async () => {
    const { app, like } = newApp()
    const target = ((await (await app.request('/api/posts')).json()) as Post[])[0]

    await like(target.id, { liked: true })
    const response = await like(target.id, { liked: true })
    const post = (await response.json()) as Post

    expect(post.likes).toBe(target.likes + 1)
  })

  it('取消点赞回到原值', async () => {
    const { app, like } = newApp()
    const target = ((await (await app.request('/api/posts')).json()) as Post[])[0]

    await like(target.id, { liked: true })
    const response = await like(target.id, { liked: false })
    const post = (await response.json()) as Post

    expect(post.likedByMe).toBe(false)
    expect(post.likes).toBe(target.likes)
  })

  it('点赞数不会降到负数', async () => {
    const { create, like } = newApp()
    const created = (await (await create({ content: '没人点赞的絮语' })).json()) as Post

    const response = await like(created.id, { liked: false })
    const post = (await response.json()) as Post

    expect(post.likes).toBe(0)
    expect(post.likedByMe).toBe(false)
  })

  it('未知 id 返回 404 NOT_FOUND', async () => {
    const { like } = newApp()
    const response = await like('missing', { liked: true })

    expect(response.status).toBe(404)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it.each([
    ['liked 不是布尔值', { liked: 'yes' }],
    ['缺少 liked', {}],
  ])('%s 返回 400 INVALID_BODY', async (_name, body) => {
    const { like } = newApp()
    const response = await like('seed-linwan', body)

    expect(response.status).toBe(400)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('INVALID_BODY')
  })
})

describe('PUT /api/posts/:id/favorite', () => {
  it('收藏后计数加一且标记已收藏', async () => {
    const { app, favorite } = newApp()
    const before = (await (await app.request('/api/posts')).json()) as Post[]
    const target = before[0]

    const response = await favorite(target.id, { favorited: true })

    expect(response.status).toBe(200)
    const post = (await response.json()) as Post
    expect(post.id).toBe(target.id)
    expect(post.favoritedByMe).toBe(true)
    expect(post.favorites).toBe(target.favorites + 1)
  })

  it('重复收藏保持幂等', async () => {
    const { app, favorite } = newApp()
    const target = ((await (await app.request('/api/posts')).json()) as Post[])[0]

    await favorite(target.id, { favorited: true })
    const response = await favorite(target.id, { favorited: true })
    const post = (await response.json()) as Post

    expect(post.favorites).toBe(target.favorites + 1)
    expect(post.favoritedByMe).toBe(true)
  })

  it('取消收藏回到原值', async () => {
    const { app, favorite } = newApp()
    const target = ((await (await app.request('/api/posts')).json()) as Post[])[0]

    await favorite(target.id, { favorited: true })
    const response = await favorite(target.id, { favorited: false })
    const post = (await response.json()) as Post

    expect(post.favoritedByMe).toBe(false)
    expect(post.favorites).toBe(target.favorites)
  })

  it('收藏数不会降到负数', async () => {
    const { create, favorite } = newApp()
    const created = (await (await create({ content: '没人收藏的絮语' })).json()) as Post

    const response = await favorite(created.id, { favorited: false })
    const post = (await response.json()) as Post

    expect(post.favorites).toBe(0)
    expect(post.favoritedByMe).toBe(false)
  })

  it('收藏写入后可在列表读到', async () => {
    const { favorite, list } = newApp()

    await favorite('seed-aju', { favorited: true })

    const posts = await list()
    const target = posts.find((post) => post.id === 'seed-aju')
    expect(target?.favorites).toBe(3)
    expect(target?.favoritedByMe).toBe(true)
  })

  it('未知 id 返回 404 NOT_FOUND', async () => {
    const { favorite } = newApp()
    const response = await favorite('missing', { favorited: true })

    expect(response.status).toBe(404)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.message).toBe('动态不存在')
  })

  it.each([
    ['favorited 不是布尔值', { favorited: 'yes' }],
    ['缺少 favorited', {}],
    ['非法 JSON', '{'],
  ])('%s 返回 400 INVALID_BODY', async (_name, body) => {
    const { favorite } = newApp()
    const response = await favorite('seed-linwan', body)

    expect(response.status).toBe(400)
    const payload = (await response.json()) as ApiError
    expect(payload.error.code).toBe('INVALID_BODY')
    expect(payload.error.message).toBe('favorited 必须是布尔值')
  })

  it('点赞与收藏互不影响', async () => {
    const { app, like, favorite } = newApp()
    const target = ((await (await app.request('/api/posts')).json()) as Post[])[0]

    const liked = (await (await like(target.id, { liked: true })).json()) as Post
    expect(liked.likes).toBe(target.likes + 1)
    expect(liked.favorites).toBe(target.favorites)
    expect(liked.favoritedByMe).toBe(false)

    const favorited = (await (await favorite(target.id, { favorited: true })).json()) as Post
    expect(favorited.likes).toBe(liked.likes)
    expect(favorited.likedByMe).toBe(true)
    expect(favorited.favorites).toBe(target.favorites + 1)

    const unliked = (await (await like(target.id, { liked: false })).json()) as Post
    expect(unliked.likes).toBe(target.likes)
    expect(unliked.favorites).toBe(target.favorites + 1)
    expect(unliked.favoritedByMe).toBe(true)
  })
})

describe('未知路径', () => {
  it.each(['/api/unknown', '/api/posts/seed-linwan'])('%s 返回统一格式的 404', async (path) => {
    const { app } = newApp()
    const response = await app.request(path)

    expect(response.status).toBe(404)
    const payload = (await response.json()) as ApiError
    expect(payload.error).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String),
    })
  })
})

describe('仓库隔离', () => {
  it('不同 app 实例的内存数据互不影响', async () => {
    const first = newApp()
    const second = newApp()

    await first.create({ content: '只写进第一个实例' })

    expect(await first.list()).toHaveLength(5)
    expect(await second.list()).toHaveLength(4)
  })
})
