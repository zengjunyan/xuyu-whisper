<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatFullTime, formatRelative } from '@/lib/datetime'
import { avatarGradient, initialOf, type Post } from '@/lib/post'

/** 超过这个长度才展示「展开全文」，四行以内保持安静 */
const EXPAND_THRESHOLD = 90

const props = defineProps<{
  post: Post
  index: number
  now: number
  highlight?: boolean
}>()

const emit = defineEmits<{ like: [id: string] }>()

const expanded = ref(false)
const popping = ref(false)
let popTimer: ReturnType<typeof setTimeout> | null = null

const canExpand = computed(() => props.post.content.length > EXPAND_THRESHOLD)
const gradient = computed(() => avatarGradient(props.post.author))
const avatarStyle = computed(() => ({
  backgroundImage: `linear-gradient(140deg, ${gradient.value[0]}, ${gradient.value[1]})`,
}))
const cardStyle = computed(() => ({ '--i': String(Math.min(props.index, 8)) }))
const timeLabel = computed(() => formatRelative(props.post.createdAt, props.now))
const fullTime = computed(() => formatFullTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const likeLabel = computed(
  () => `${props.post.likedByMe ? '取消点赞' : '点赞'}，${props.post.author}`,
)

function onLike(): void {
  if (!props.post.likedByMe) {
    popping.value = true
    if (popTimer) clearTimeout(popTimer)
    popTimer = setTimeout(() => {
      popping.value = false
      popTimer = null
    }, 460)
  }
  emit('like', props.post.id)
}

onBeforeUnmount(() => {
  if (popTimer) clearTimeout(popTimer)
})
</script>

<template>
  <article class="post" :class="{ 'is-new': highlight }" :style="cardStyle" :data-id="post.id">
    <header class="post__head">
      <span class="avatar post__avatar" aria-hidden="true" :style="avatarStyle">
        {{ initialOf(post.author) }}
      </span>
      <div class="post__meta">
        <span class="post__author">{{ post.author }}</span>
        <time class="post__time" :datetime="isoTime" :title="fullTime">{{ timeLabel }}</time>
      </div>
      <span class="post__seal" aria-hidden="true">絮</span>
    </header>

    <p class="post__body" :class="{ 'is-expanded': expanded }">{{ post.content }}</p>

    <button
      v-if="canExpand"
      type="button"
      class="expand-btn"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : '展开全文' }}
    </button>

    <footer class="post__foot">
      <button
        type="button"
        class="like-btn"
        :class="{ 'is-popping': popping }"
        :aria-pressed="post.likedByMe"
        :aria-label="likeLabel"
        @click="onLike"
      >
        <svg class="like-btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 20.1s-7.4-4.6-7.4-9.4A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.4 3.1c0 4.8-7.4 9.4-7.4 9.4Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        <span class="like-btn__count">{{ post.likes }}</span>
      </button>
    </footer>
  </article>
</template>
