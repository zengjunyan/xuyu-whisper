<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Post } from '@/lib/post'
import PostCard from './PostCard.vue'

const props = defineProps<{
  posts: readonly Post[]
  highlightId?: string
}>()

const emit = defineEmits<{ like: [id: string]; compose: [] }>()

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

const countLabel = computed(() =>
  props.posts.length ? `共 ${props.posts.length} 条` : '暂无内容',
)

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})
</script>

<template>
  <section class="feed-section" aria-labelledby="feed-title">
    <div class="feed-head">
      <h2 id="feed-title" class="feed-head__title">最新絮语</h2>
      <span id="feed-count" class="feed-head__count">{{ countLabel }}</span>
    </div>

    <div class="feed" aria-live="polite">
      <PostCard
        v-for="(post, index) in posts"
        :key="post.id"
        :post="post"
        :index="index"
        :now="now"
        :highlight="post.id === highlightId"
        @like="emit('like', $event)"
      />
    </div>

    <div v-if="!posts.length" class="empty">
      <svg class="empty__art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 7" opacity=".5" />
        <path
          d="M38 44h44a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H52l-12 9v-9h-2a6 6 0 0 1-6-6V50a6 6 0 0 1 6-6Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <path d="M48 58h24M48 68h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <h3 class="empty__title">这里还很安静</h3>
      <p class="empty__text">写下第一条絮语，让时间线有了起点。</p>
      <button id="empty-cta" class="btn btn--ghost" type="button" @click="emit('compose')">
        写下第一条
      </button>
    </div>
  </section>
</template>
