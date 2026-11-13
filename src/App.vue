<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppToast from '@/components/AppToast.vue'
import ComposerCard from '@/components/ComposerCard.vue'
import FeedSection from '@/components/FeedSection.vue'
import IntroSection from '@/components/IntroSection.vue'
import SceneBackdrop from '@/components/SceneBackdrop.vue'
import TopBar from '@/components/TopBar.vue'
import { formatToday } from '@/lib/datetime'
import type { Post } from '@/lib/post'
import { usePostsStore } from '@/stores/posts'
import { useSceneStore } from '@/stores/scene'
import { useThemeStore } from '@/stores/theme'
import { useToastStore } from '@/stores/toast'

const posts = usePostsStore()
const scene = useSceneStore()
const theme = useThemeStore()
const toast = useToastStore()

const today = ref(formatToday())
const highlightId = ref<string | null>(null)
const composer = ref<InstanceType<typeof ComposerCard> | null>(null)

let dayTimer: ReturnType<typeof setInterval> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null

// 主题偏好仍读本地；动态改为挂载时向后端拉取
theme.init()
const initialLoad = posts.load()

onMounted(async () => {
  dayTimer = setInterval(() => {
    today.value = formatToday()
  }, 60_000)

  await initialLoad

  if (posts.error) toast.show(posts.error)
  else if (!theme.storageOK) toast.show('当前浏览器无法使用本地存储，主题偏好不会保存')
})

onBeforeUnmount(() => {
  theme.dispose()
  if (dayTimer) clearInterval(dayTimer)
  if (highlightTimer) clearTimeout(highlightTimer)
})

function onPublished(post: Post): void {
  highlightId.value = post.id
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightId.value = null
    highlightTimer = null
  }, 1400)
}

function onCompose(): void {
  composer.value?.focus()
}
</script>

<template>
  <SceneBackdrop />

  <a class="skip-link" href="#composer-input">跳到发布框</a>

  <TopBar />

  <main class="shell">
    <IntroSection :today="today" :scene="scene.current" />

    <ComposerCard ref="composer" @published="onPublished" />

    <FeedSection
      :posts="posts.sortedPosts"
      :highlight-id="highlightId ?? undefined"
      @like="posts.toggleLike"
      @compose="onCompose"
    />

    <footer class="footer">
      <p class="footer__line">絮语 Whisper · 极简本地动态</p>
      <p class="footer__note">内容保存在本地 API 服务的内存中，服务重启后回到示例数据。</p>
    </footer>
  </main>

  <AppToast />
</template>
