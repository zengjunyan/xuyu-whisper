import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { HOUR, SCENES, sceneAt, sceneIndexFor, type Scene } from '@/lib/scenes'
import { useSceneStore } from '@/stores/scene'

const BASE = new Date('2026-11-13T12:34:56+08:00').getTime()

describe('scene 排期函数', () => {
  it('同一小时内排期固定，跨小时顺延一张', () => {
    const index = sceneIndexFor(BASE)
    expect(sceneIndexFor(BASE + 20 * 60_000)).toBe(index)
    expect(sceneIndexFor(BASE + HOUR)).toBe((index + 1) % SCENES.length)
  })

  it('按小时序号对壁纸数量取模', () => {
    const slot = Math.floor(BASE / HOUR)
    expect(sceneIndexFor(BASE)).toBe(slot % SCENES.length)
    expect(sceneIndexFor(BASE + HOUR * SCENES.length)).toBe((slot + SCENES.length) % SCENES.length)
  })

  it('sceneAt 支持越界与负数索引', () => {
    expect(sceneAt(0)).toEqual(SCENES[0])
    expect(sceneAt(SCENES.length)).toEqual(SCENES[0])
    expect(sceneAt(-1)).toEqual(SCENES[SCENES.length - 1])
  })

  it('内置 8 张壁纸，全部带有名称与色调', () => {
    expect(SCENES).toHaveLength(8)
    SCENES.forEach((scene: Scene) => {
      expect(scene.file).toMatch(/^assets\/bg-0[1-8]\.jpg$/)
      expect(scene.name.length).toBeGreaterThan(0)
      expect(['light', 'dark']).toContain(scene.tone)
    })
    expect(SCENES[3].tone).toBe('dark')
    expect(SCENES[7].tone).toBe('dark')
  })
})

describe('scene store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('init 使用当前整点的排期', () => {
    const scene = useSceneStore()
    scene.init(BASE)

    expect(scene.index).toBe(sceneIndexFor(BASE))
    expect(scene.current).toEqual(SCENES[sceneIndexFor(BASE)])
    expect(scene.initialized).toBe(true)
  })

  it('手动换一张在本小时内保持，下一次顺延', () => {
    const scene = useSceneStore()
    scene.init(BASE)
    const before = scene.index

    const first = scene.next(BASE)
    expect(scene.index).toBe((before + 1) % SCENES.length)
    expect(scene.current).toEqual(first)
    expect(scene.manualIndex).toBe(scene.index)

    expect(scene.currentIndex(BASE + 30 * 60_000)).toBe(scene.index)

    const firstIndex = scene.index
    const second = scene.next(BASE + 40 * 60_000)
    expect(scene.index).toBe((firstIndex + 1) % SCENES.length)
    expect(scene.current).toEqual(second)
  })

  it('整点后忽略本小时的手动选择，回到排期', () => {
    const scene = useSceneStore()
    scene.init(BASE)
    scene.next(BASE)

    const later = BASE + HOUR
    expect(scene.currentIndex(later)).toBe(sceneIndexFor(later))

    scene.sync(later)
    expect(scene.index).toBe(sceneIndexFor(later))
    expect(scene.manualIndex).toBeNull()
    expect(scene.manualSlot).toBeNull()
  })

  it('sync 在同一小时不改变当前壁纸', () => {
    const scene = useSceneStore()
    scene.init(BASE)
    scene.next(BASE)
    const manual = scene.index

    scene.sync(BASE + 10 * 60_000)
    expect(scene.index).toBe(manual)
  })

  it('可以把当前色调写到文档上，供主题遮罩使用', () => {
    const scene = useSceneStore()
    scene.init(BASE)
    scene.applyTone()
    expect(document.documentElement.dataset.sceneTone).toBe(SCENES[scene.index].tone)

    scene.select(3, BASE)
    scene.applyTone()
    expect(document.documentElement.dataset.sceneTone).toBe('dark')
  })

  it('select 会规范化越界索引', () => {
    const scene = useSceneStore()
    scene.init(BASE)

    scene.select(SCENES.length + 2, BASE)
    expect(scene.index).toBe(2)

    scene.select(-1, BASE)
    expect(scene.index).toBe(SCENES.length - 1)
  })
})
