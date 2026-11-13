import { sanitizePost, type Post } from './post'

/** 前端唯一的数据入口：只通过同源 /api 访问后端，不再读写 localStorage */
const POSTS_ENDPOINT = '/api/posts'

const NETWORK_MESSAGE = '无法连接服务器，请稍后重试'
const FALLBACK_MESSAGE = '请求失败，请稍后重试'

export interface ApiErrorOptions {
  /** 0 表示请求没有到达服务器 */
  status?: number
  code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? 'UNKNOWN'
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const body = payload as { error?: { code?: unknown; message?: unknown } } | null
  const message =
    typeof body?.error?.message === 'string' && body.error.message.trim()
      ? body.error.message
      : FALLBACK_MESSAGE
  const code =
    typeof body?.error?.code === 'string' && body.error.code ? body.error.code : 'HTTP_ERROR'

  return new ApiError(message, { status, code })
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(NETWORK_MESSAGE, { status: 0, code: 'NETWORK' })
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) throw toApiError(response.status, payload)
  return payload
}

function parsePost(payload: unknown): Post {
  const post = sanitizePost(payload)
  if (!post) throw new ApiError('服务器返回的数据无法识别', { status: 502, code: 'INVALID_RESPONSE' })
  return post
}

/** 拉取全部动态；非法条目会被逐条清洗掉 */
export async function fetchPosts(): Promise<Post[]> {
  const payload = await request(POSTS_ENDPOINT)
  if (!Array.isArray(payload)) return []

  return payload
    .map((item) => sanitizePost(item))
    .filter((post): post is Post => post !== null)
}

export async function createPost(input: { content: string; author?: string }): Promise<Post> {
  const body: Record<string, string> = { content: input.content }
  if (input.author) body.author = input.author

  const payload = await request(POSTS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parsePost(payload)
}

export async function setPostLike(id: string, liked: boolean): Promise<Post> {
  const payload = await request(`${POSTS_ENDPOINT}/${encodeURIComponent(id)}/like`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked }),
  })

  return parsePost(payload)
}

export async function setPostFavorite(id: string, favorited: boolean): Promise<Post> {
  const payload = await request(`${POSTS_ENDPOINT}/${encodeURIComponent(id)}/favorite`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorited }),
  })

  return parsePost(payload)
}
