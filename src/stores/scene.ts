import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  SCENES,
  hourSlot,
  normalizeIndex,
  sceneAt,
  sceneIndexFor,
  type Scene,
} from '@/lib/scenes'

export const useSceneStore = defineStore('scene', () => {
  const index = ref(0)
  const manualIndex = ref<number | null>(null)
  const manualSlot = ref<number | null>(null)
  const initialized = ref(false)

  const current = computed<Scene>(() => sceneAt(index.value))
  const tone = computed(() => current.value.tone)

  /** 当前小时应显示的壁纸：手动选择只在当小时内有效 */
  function currentIndex(now: number = Date.now()): number {
    if (manualIndex.value !== null && manualSlot.value === hourSlot(now)) {
      return normalizeIndex(manualIndex.value)
    }
    return sceneIndexFor(now)
  }

  function init(now: number = Date.now()): void {
    index.value = currentIndex(now)
    initialized.value = true
  }

  /** 指定某一张（手动换背景） */
  function select(target: number, now: number = Date.now()): Scene {
    const normalized = normalizeIndex(target)
    manualIndex.value = normalized
    manualSlot.value = hourSlot(now)
    index.value = normalized
    return current.value
  }

  /** 顺延到下一张 */
  function next(now: number = Date.now()): Scene {
    return select(currentIndex(now) + 1, now)
  }

  /** 与当前时间对齐：跨整点后清空手动选择并回到排期 */
  function sync(now: number = Date.now()): void {
    if (manualSlot.value !== null && manualSlot.value !== hourSlot(now)) {
      manualIndex.value = null
      manualSlot.value = null
    }
    index.value = currentIndex(now)
  }

  /** 让遮罩知道画面明暗，浅色主题遇到深色壁纸时会加强遮罩 */
  function applyTone(): void {
    document.documentElement.dataset.sceneTone = tone.value
  }

  return {
    scenes: SCENES,
    index,
    manualIndex,
    manualSlot,
    initialized,
    current,
    tone,
    currentIndex,
    init,
    select,
    next,
    sync,
    applyTone,
  }
})
