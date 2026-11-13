import { beforeEach, vi } from 'vitest'

// 该文件对所有测试文件生效：服务端用例跑在 node 环境，此时没有 DOM，需要全部跳过。
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined'

// jsdom 未实现 scrollIntoView，组件滚动到发布框时会调用
if (hasDom) Element.prototype.scrollIntoView = vi.fn()

/**
 * Node 22+ 的实验性 localStorage 全局会遮蔽 jsdom 的实现（未提供 --localstorage-file 时为 undefined），
 * 同时部分 jsdom 版本在 Vitest 下不暴露 Storage。这里用一份最小可用实现兜底，
 * 让测试在任何 Node 版本下都以同样的 API 运行。
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}

const existing = (() => {
  if (!hasDom) return null
  try {
    const candidate = globalThis.localStorage
    return candidate && typeof candidate.getItem === 'function' ? candidate : null
  } catch {
    return null
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: existing ?? new MemoryStorage(),
})

// 每个用例前重置浏览器环境中的持久化痕迹与文档级状态
beforeEach(() => {
  localStorage.clear()
  if (!hasDom) return

  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-theme-mode')
  document.documentElement.removeAttribute('data-scene-tone')
  document.body.innerHTML = ''
})
