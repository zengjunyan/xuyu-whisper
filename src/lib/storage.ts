/**
 * localStorage 键名。
 * 动态数据已迁移到后端 REST API，这里只剩纯客户端偏好（明暗主题）。
 */
export const THEME_KEY = 'whisper.theme.v2'
export const LEGACY_THEME_KEY = 'whisper.theme.v1'

export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ReadResult {
  /** 存储本身是否可用（区分「没有数据」与「读不了」） */
  ok: boolean
  value: string | null
}

/** 取浏览器存储；隐私模式或策略限制下可能直接抛错 */
export function getStorageBackend(): StorageBackend | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readRawSafe(
  key: string,
  backend: StorageBackend | null = getStorageBackend(),
): ReadResult {
  if (!backend) return { ok: false, value: null }
  try {
    return { ok: true, value: backend.getItem(key) }
  } catch {
    return { ok: false, value: null }
  }
}

export function writeRaw(
  key: string,
  value: string,
  backend: StorageBackend | null = getStorageBackend(),
): boolean {
  if (!backend) return false
  try {
    backend.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeRaw(
  key: string,
  backend: StorageBackend | null = getStorageBackend(),
): boolean {
  if (!backend) return false
  try {
    backend.removeItem(key)
    return true
  } catch {
    return false
  }
}
