<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Post } from '@/lib/post'
import PostCard from './PostCard.vue'

/** 时间线视图：全部动态，或只留下我收藏的那些 */
type FeedFilter = 'all' | 'favorites'

const props = defineProps<{
  posts: readonly Post[]
  highlightId?: string
}>()

const emit = defineEmits<{ like: [id: string]; favorite: [id: string]; compose: [] }>()

const now = ref(Date.now())
const filter = ref<FeedFilter>('all')
let clock: ReturnType<typeof setInterval> | null = null

const visiblePosts = computed(() =>
  filter.value === 'all' ? props.posts : props.posts.filter((post) => post.favoritedByMe),
)

const countLabel = computed(() => {
  const count = visiblePosts.value.length
  if (filter.value === 'favorites') return count ? `收藏 ${count} 条` : '暂无收藏'
  return count ? `共 ${count} 条` : '暂无内容'
})

/** 切回「全部」，供收藏空状态里的按钮使用 */
function resetFilter(): void {
  filter.value = 'all'
}

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

    <div class="feed-filter" role="group" aria-label="动态筛选">
      <button
        id="filter-all"
        type="button"
        class="feed-filter__tab"
        :aria-pressed="filter === 'all'"
        @click="filter = 'all'"
      >
        全部
      </button>
      <button
        id="filter-favorites"
        type="button"
        class="feed-filter__tab"
        :aria-pressed="filter === 'favorites'"
        @click="filter = 'favorites'"
      >
        我的收藏
      </button>
    </div>

    <div class="feed" aria-live="polite">
      <PostCard
        v-for="(post, index) in visiblePosts"
        :key="post.id"
        :post="post"
        :index="index"
        :now="now"
        :highlight="post.id === highlightId"
        @like="emit('like', $event)"
        @favorite="emit('favorite', $event)"
      />
    </div>

    <div v-if="!visiblePosts.length" class="empty">
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

      <template v-if="filter === 'favorites'">
        <h3 class="empty__title">还没有收藏</h3>
        <p class="empty__text">在喜欢的絮语上点一下书签，这里就会亮起来。</p>
        <button id="empty-reset" class="btn btn--ghost" type="button" @click="resetFilter">
          回到全部
        </button>
      </template>

      <template v-else>
        <h3 class="empty__title">这里还很安静</h3>
        <p class="empty__text">写下第一条絮语，让时间线有了起点。</p>
        <button id="empty-cta" class="btn btn--ghost" type="button" @click="emit('compose')">
          写下第一条
        </button>
      </template>
    </div>
  </section>
</template>
