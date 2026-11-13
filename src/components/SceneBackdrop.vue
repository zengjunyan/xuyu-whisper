<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { HOUR, hourSlot, normalizeIndex, sceneAt } from '@/lib/scenes'
import { useSceneStore } from '@/stores/scene'

const scene = useSceneStore()

/** 双层容器做交叉淡化，只改变 opacity / transform */
const layers = ref<[string, string]>(['', ''])
const active = ref<0 | 1>(0)
const fallback = ref(false)
const shifting = ref(false)

let requestId = 0
let appliedIndex: number | null = null
let hourTimer: ReturnType<typeof setTimeout> | null = null
let shiftTimer: ReturnType<typeof setTimeout> | null = null
let idleHandle: number | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
const preloadTimers = new Set<ReturnType<typeof setTimeout>>()

/** 预加载并解码，4 秒视为失败 */
function preload(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => finish(false), 4000)
    preloadTimers.add(timer)

    const image = new Image()

    function finish(ok: boolean): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      preloadTimers.delete(timer)
      resolve(ok)
    }

    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(
          () => finish(true),
          () => finish(true),
        )
      } else {
        finish(true)
      }
    }
    image.onerror = () => finish(false)
    image.src = file
  })
}

async function applyScene(
  index: number,
  options: { force?: boolean; breathe?: boolean } = {},
): Promise<void> {
  const target = normalizeIndex(index)
  if (!options.force && appliedIndex === target) return

  const id = (requestId += 1)
  const file = sceneAt(target).file
  scene.applyTone()

  const ok = await preload(file)
  // 只接受最后一次切换请求，连续点击时旧图片不会覆盖新图片
  if (id !== requestId) return

  const incoming: 0 | 1 = active.value === 0 ? 1 : 0
  const next: [string, string] = [layers.value[0], layers.value[1]]
  next[incoming] = ok ? `url("${file}")` : ''

  layers.value = next
  fallback.value = !ok
  active.value = incoming
  appliedIndex = target

  if (options.breathe) {
    shifting.value = true
    if (shiftTimer) clearTimeout(shiftTimer)
    shiftTimer = setTimeout(() => {
      shifting.value = false
      shiftTimer = null
    }, 1300)
  }
}

/** 整点后自动切到排期中的下一张 */
function scheduleTick(): void {
  if (hourTimer) clearTimeout(hourTimer)

  const now = Date.now()
  const nextSlotStart = (hourSlot(now) + 1) * HOUR + 800

  hourTimer = setTimeout(
    () => {
      const before = scene.index
      scene.sync()
      scene.applyTone()
      if (scene.index === before) void applyScene(scene.index, { force: true, breathe: true })
      scheduleTick()
    },
    Math.max(1200, nextSlotStart - now),
  )
}

function onVisibilityChange(): void {
  if (document.hidden) return

  scene.sync()
  scene.applyTone()
  void applyScene(scene.index, { breathe: true })
  scheduleTick()
}

scene.init()
scene.applyTone()

watch(
  () => scene.index,
  (index) => {
    void applyScene(index, { breathe: true })
  },
  { immediate: true },
)

/** 空闲时预加载下一张，整点切换不出现空白帧 */
function preloadUpcoming(): void {
  void preload(sceneAt(scene.index + 1).file)
}

onMounted(() => {
  scheduleTick()
  document.addEventListener('visibilitychange', onVisibilityChange)

  if (typeof window.requestIdleCallback === 'function') {
    idleHandle = window.requestIdleCallback(preloadUpcoming, { timeout: 4000 })
  } else {
    idleTimer = setTimeout(preloadUpcoming, 2600)
  }
})

onBeforeUnmount(() => {
  requestId += 1
  if (hourTimer) clearTimeout(hourTimer)
  if (shiftTimer) clearTimeout(shiftTimer)
  if (idleHandle !== null) window.cancelIdleCallback(idleHandle)
  if (idleTimer) clearTimeout(idleTimer)
  preloadTimers.forEach((timer) => clearTimeout(timer))
  preloadTimers.clear()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div
    class="scene-stack"
    :class="{ 'is-fallback': fallback, 'is-shifting': shifting }"
    aria-hidden="true"
  >
    <div
      class="scene-layer"
      :class="{ 'is-active': active === 0 }"
      :style="{ backgroundImage: layers[0] }"
      data-scene="a"
    />
    <div
      class="scene-layer"
      :class="{ 'is-active': active === 1 }"
      :style="{ backgroundImage: layers[1] }"
      data-scene="b"
    />
    <div class="scene-veil" />
    <div class="scene-glow" />
    <div class="scene-grain" />
  </div>
</template>
