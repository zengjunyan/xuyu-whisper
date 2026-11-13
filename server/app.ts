import { Hono } from 'hono'
import type { Context } from 'hono'
import { createPostStore, type PostStore } from './store'

export type ApiErrorCode = 'INVALID_BODY' | 'INVALID_CONTENT' | 'NOT_FOUND'

function fail(c: Context, status: 400 | 404, code: ApiErrorCode, message: string): Response {
  return c.json({ error: { code, message } }, status)
}

/**
 * 读取并校验 JSON 对象请求体。
 * 不用 c.req.json()：非法 JSON 会抛出异常变成 500，这里统一收敛为 INVALID_BODY。
 */
async function readJsonObject(c: Context): Promise<Record<string, unknown> | null> {
  let text: string
  try {
    text = await c.req.text()
  } catch {
    return null
  }

  if (!text.trim()) return null

  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/** 只组装路由，不监听端口；测试与前端 mock 复用同一个实例工厂 */
export function createApp(store: PostStore = createPostStore()): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/posts', (c) => c.json(store.list()))

  app.post('/api/posts', async (c) => {
    const body = await readJsonObject(c)
    if (!body) return fail(c, 400, 'INVALID_BODY', '请求体必须是一个 JSON 对象')

    const post = store.create({ content: body.content, author: body.author })
    if (!post) return fail(c, 400, 'INVALID_CONTENT', '内容不能为空')

    return c.json(post, 201)
  })

  app.put('/api/posts/:id/like', async (c) => {
    const body = await readJsonObject(c)
    if (!body || typeof body.liked !== 'boolean') {
      return fail(c, 400, 'INVALID_BODY', 'liked 必须是布尔值')
    }

    const post = store.setLike(c.req.param('id'), body.liked)
    if (!post) return fail(c, 404, 'NOT_FOUND', '动态不存在')

    return c.json(post)
  })

  app.notFound((c) => fail(c, 404, 'NOT_FOUND', '接口不存在'))

  return app
}
