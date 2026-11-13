import { vi } from 'vitest'
import { createApp } from '../../server/app'
import type { PostStore } from '../../server/store'

export interface ApiMock {
  /** 同一个 Hono 实例，测试可直接用它断言服务端状态 */
  app: ReturnType<typeof createApp>
  /** 读取服务端当前的动态（等价于真实 GET /api/posts） */
  serverPosts(): Promise<unknown[]>
  /** 让接下来的 N 次 fetch 直接抛错，模拟断网 */
  failNextNetwork(times?: number): void
  /** 让接下来的 N 次请求返回指定状态码与错误体 */
  failNextResponse(status: number, code?: string): void
  restore(): void
}

/**
 * 把全局 fetch 接到真实的 Hono 应用上：
 * 组件与 store 测试跑的仍是真实路由与内存仓库，只是不经过网络。
 */
export function installApiMock(store?: PostStore): ApiMock {
  const app = createApp(store)
  let networkFailures = 0
  let responseFailure: { status: number; code: string } | null = null

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (networkFailures > 0) {
      networkFailures -= 1
      throw new TypeError('Failed to fetch')
    }

    if (responseFailure) {
      const { status, code } = responseFailure
      responseFailure = null
      return new Response(JSON.stringify({ error: { code, message: '模拟失败' } }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(raw, 'http://localhost')
    return app.request(`${url.pathname}${url.search}`, init)
  }

  vi.stubGlobal('fetch', vi.fn(impl))

  return {
    app,
    async serverPosts() {
      const response = await app.request('/api/posts')
      return (await response.json()) as unknown[]
    },
    failNextNetwork(times = 1) {
      networkFailures = times
    },
    failNextResponse(status, code = 'INTERNAL') {
      responseFailure = { status, code }
    },
    restore() {
      vi.unstubAllGlobals()
    },
  }
}
