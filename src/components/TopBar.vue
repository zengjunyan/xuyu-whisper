<script setup lang="ts">
import { useSceneStore } from '@/stores/scene'
import { useThemeStore } from '@/stores/theme'
import { useToastStore } from '@/stores/toast'

const theme = useThemeStore()
const scene = useSceneStore()
const toast = useToastStore()

function toggleTheme(): void {
  theme.cycle()
  toast.show(
    theme.mode === 'system'
      ? `已跟随系统 · ${theme.resolved === 'dark' ? '深色' : '浅色'}`
      : `已切换为${theme.label}模式`,
  )
}

function nextScene(): void {
  toast.show(`换了一张 · ${scene.next().name}`)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__inner">
      <a class="brand" href="./index.html" aria-label="絮语 Whisper 首页">
        <span class="brand__mark" aria-hidden="true">絮</span>
        <span class="brand__text">
          <strong class="brand__cn">絮语</strong>
          <em class="brand__en">Whisper</em>
        </span>
      </a>

      <div class="topbar__actions">
        <button
          id="scene-next"
          class="icon-btn icon-btn--scene"
          type="button"
          aria-label="换一张背景"
          title="换一张背景"
          @click="nextScene"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6" />
            <circle cx="8.6" cy="10.2" r="1.7" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M4.6 17.2l4.6-4.3 3.2 2.9 3-2.7 4 4.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          id="theme-toggle"
          class="icon-btn icon-btn--theme"
          type="button"
          :aria-label="theme.toggleLabel"
          :aria-pressed="theme.resolved === 'dark'"
          :title="`明暗主题：${theme.label}（点击切换）`"
          @click="toggleTheme"
        >
          <svg class="icon icon--sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.7" />
            <g stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
            </g>
          </svg>
          <svg class="icon icon--moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.7 8.7 0 1 0 10.6 10.6Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
          </svg>
          <span class="theme-dot" aria-hidden="true" />
        </button>
      </div>
    </div>
  </header>
</template>
