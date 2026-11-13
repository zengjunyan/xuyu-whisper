<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { MAX_LEN, type Post } from '@/lib/post'
import { usePostsStore } from '@/stores/posts'
import { useToastStore } from '@/stores/toast'

const emit = defineEmits<{ published: [post: Post] }>()

const posts = usePostsStore()
const toast = useToastStore()

const draft = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const remaining = computed(() => MAX_LEN - draft.value.length)
const isWarn = computed(() => remaining.value <= 40 && remaining.value > 0)
const isLimit = computed(() => remaining.value <= 0)
const canPublish = computed(() => draft.value.trim().length > 0 && !posts.submitting)
const tip = computed(() =>
  isWarn.value ? `还能写下 ${remaining.value} 字，慢慢来` : '按 Ctrl / ⌘ + Enter 也可以快速发布',
)

function autoGrow(): void {
  const element = textarea.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 240)}px`
  element.style.overflowY = element.scrollHeight > 240 ? 'auto' : 'hidden'
}

function focus(): void {
  textarea.value?.focus()
  textarea.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function submit(): Promise<void> {
  if (!canPublish.value) return

  const post = await posts.publish(draft.value)
  if (!post) {
    if (posts.error) toast.show(posts.error)
    return
  }

  draft.value = ''
  emit('published', post)
  toast.show('已发布，静候回响')

  void nextTick(autoGrow)
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void submit()
  }
}

defineExpose({ focus })
</script>

<template>
  <section class="composer" aria-labelledby="composer-title">
    <div class="composer__head">
      <span class="avatar avatar--me" aria-hidden="true">我</span>
      <div class="composer__id">
        <h2 id="composer-title" class="composer__name">我自己</h2>
        <p class="composer__hint">此刻，心里飘着什么？</p>
      </div>
    </div>

    <label class="visually-hidden" for="composer-input">动态内容</label>
    <textarea
      id="composer-input"
      ref="textarea"
      v-model="draft"
      class="composer__input"
      rows="3"
      :maxlength="MAX_LEN"
      placeholder="此刻，想说点什么？"
      spellcheck="false"
      @input="autoGrow"
      @keydown="onKeydown"
    />

    <div class="composer__foot">
      <div
        id="meter"
        class="meter"
        :class="{ 'is-warn': isWarn, 'is-limit': isLimit }"
        role="status"
        aria-live="off"
      >
        <span id="char-count" class="meter__num">{{ remaining }}</span>
        <span class="meter__unit">字可写</span>
      </div>
      <button id="publish-btn" class="btn btn--primary" type="button" :disabled="!canPublish" @click="submit">
        <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4.5 12.2 19.4 5.1c.6-.3 1.2.3 1 .9l-2.8 12.6c-.2.7-1 .9-1.5.4l-4-3.5-2.6 2.6c-.4.4-1.1.2-1.2-.4l-.7-4.2-3.4-1.2c-.7-.2-.7-1.2.3-1.6Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
        发布
      </button>
    </div>
    <p id="composer-tip" class="composer__tip">{{ tip }}</p>
  </section>
</template>
