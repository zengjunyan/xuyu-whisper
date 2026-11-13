import { describe, expect, it, vi } from 'vitest'
import { getStorageBackend, readRawSafe, removeRaw, writeRaw, type StorageBackend } from '@/lib/storage'

function throwingBackend(): StorageBackend {
  return {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('quota')
    },
    removeItem() {
      throw new Error('denied')
    },
  }
}

describe('storage', () => {
  it('读写删走同一个后端', () => {
    const backend = getStorageBackend()
    expect(backend).not.toBeNull()

    expect(writeRaw('k', 'v', backend)).toBe(true)
    expect(readRawSafe('k', backend)).toEqual({ ok: true, value: 'v' })
    expect(removeRaw('k', backend)).toBe(true)
    expect(readRawSafe('k', backend)).toEqual({ ok: true, value: null })
  })

  it('读取失败时返回 ok:false，不抛异常', () => {
    expect(readRawSafe('k', throwingBackend())).toEqual({ ok: false, value: null })
  })

  it('写入失败时返回 false，不抛异常', () => {
    expect(writeRaw('k', 'v', throwingBackend())).toBe(false)
  })

  it('删除失败时返回 false，不抛异常', () => {
    expect(removeRaw('k', throwingBackend())).toBe(false)
  })

  it('localStorage 不可访问时返回 null', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })

    try {
      expect(getStorageBackend()).toBeNull()
      expect(readRawSafe('k')).toEqual({ ok: false, value: null })
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
      vi.restoreAllMocks()
    }
  })
})
