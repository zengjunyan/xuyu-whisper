<script setup lang="ts">
import type { Scene } from '@/lib/scenes'

defineProps<{
  today: string
  scene: Scene
}>()
</script>

<template>
  <section class="intro" aria-labelledby="intro-title">
    <div class="intro__top">
      <p id="today-label" class="intro__date">{{ today }}</p>
      <span id="scene-chip" class="scene-chip" :title="`当前背景 · ${scene.name}`">
        <span class="scene-chip__dot" aria-hidden="true" />
        <span id="scene-name" class="scene-chip__name">{{ scene.name }}</span>
      </span>
    </div>
    <h1 id="intro-title" class="intro__title">把此刻，轻轻放下</h1>
    <p class="intro__sub">没有推荐，没有打扰，只有你自己的时间线。</p>
  </section>
</template>
