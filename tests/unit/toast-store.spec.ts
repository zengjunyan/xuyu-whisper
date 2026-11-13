import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '@/stores/toast'

describe('toast store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认不可见', () => {
    const toast = useToastStore()
    expect(toast.visible).toBe(false)
    expect(toast.message).toBe('')
  })

  it('显示后 2.2 秒自动隐藏', () => {
    const toast = useToastStore()
    toast.show('已发布')

    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('已发布')

    vi.advanceTimersByTime(2199)
    expect(toast.visible).toBe(true)

    vi.advanceTimersByTime(1)
    expect(toast.visible).toBe(false)
  })

  it('连续提示会重置计时，自定义时长生效', () => {
    const toast = useToastStore()
    toast.show('第一条', 1000)
    vi.advanceTimersByTime(800)

    toast.show('第二条', 1000)
    vi.advanceTimersByTime(800)
    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('第二条')

    vi.advanceTimersByTime(200)
    expect(toast.visible).toBe(false)
  })

  it('可以主动隐藏', () => {
    const toast = useToastStore()
    toast.show('提示')
    toast.hide()
    expect(toast.visible).toBe(false)
  })
})
