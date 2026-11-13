import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, createPost, fetchPosts, setPostFavorite, setPostLike } from '@/lib/api'
import { ME, sanitizePost, sortPosts, type Post } from '@/lib/post'

/** 发布后的冷却时间，避免连点产生重复动态 */
export const PUBLISH_COOLDOWN = 320

export interface PublishOptions {
  author?: string
  now?: number
}

function messageOf(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) return reason.message
  if (reason instanceof Error && reason.message) return reason.message
  return fallback
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref<Post[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  const sortedPosts = computed(() => sortPosts(posts.value))
  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => total.value === 0)
  const countLabel = computed(() => (isEmpty.value ? '暂无内容' : `共 ${total.value} 条`))

  let cooldownTimer: ReturnType<typeof setTimeout> | null = null
  let pendingLoad: Promise<void> | null = null

  /** 从后端拉取动态；并发调用只会发出一次请求 */
  function load(): Promise<void> {
    if (pendingLoad) return pendingLoad

    loading.value = true
    error.value = null

    pendingLoad = (async () => {
      try {
        posts.value = sortPosts(await fetchPosts())
      } catch (reason) {
        error.value = messageOf(reason, '加载失败，请稍后重试')
      } finally {
        loading.value = false
        loaded.value = true
        pendingLoad = null
      }
    })()

    return pendingLoad
  }

  function startCooldown(): void {
    submitting.value = true
    if (cooldownTimer) clearTimeout(cooldownTimer)
    cooldownTimer = setTimeout(() => {
      submitting.value = false
      cooldownTimer = null
    }, PUBLISH_COOLDOWN)
  }

  /** 发布一条动态；内容为空、仍在冷却期或服务端拒绝时返回 null */
  async function publish(content: string, options: PublishOptions = {}): Promise<Post | null> {
    if (submitting.value) return null

    // 先用前端同一套规则做一次本地校验，避免明显非法的请求发出去
    const draft = sanitizePost({
      author: options.author ?? ME,
      content,
      createdAt: options.now ?? Date.now(),
      likes: 0,
      likedByMe: false,
    })
    if (!draft) {
      error.value = '内容不能为空'
      return null
    }

    submitting.value = true
    try {
      const created = await createPost({ content: draft.content, author: draft.author })
      posts.value = [created, ...posts.value]
      error.value = null
      return created
    } catch (reason) {
      error.value = messageOf(reason, '发布失败，请稍后重试')
      return null
    } finally {
      startCooldown()
    }
  }

  /** 切换点赞：先乐观更新界面，失败则回滚；未知 id 返回 null */
  async function toggleLike(id: string): Promise<Post | null> {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return null

    const previous = { likes: post.likes, likedByMe: post.likedByMe }
    const next = !previous.likedByMe

    post.likedByMe = next
    post.likes = Math.max(0, previous.likes + (next ? 1 : -1))

    try {
      const updated = await setPostLike(id, next)
      post.likedByMe = updated.likedByMe
      post.likes = updated.likes
      error.value = null
      return post
    } catch (reason) {
      post.likes = previous.likes
      post.likedByMe = previous.likedByMe
      error.value = messageOf(reason, '操作失败，请稍后重试')
      return null
    }
  }

  /** 切换收藏：与点赞同构，先乐观更新界面，失败则回滚；未知 id 返回 null */
  async function toggleFavorite(id: string): Promise<Post | null> {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return null

    const previous = { favorites: post.favorites, favoritedByMe: post.favoritedByMe }
    const next = !previous.favoritedByMe

    post.favoritedByMe = next
    post.favorites = Math.max(0, previous.favorites + (next ? 1 : -1))

    try {
      const updated = await setPostFavorite(id, next)
      post.favoritedByMe = updated.favoritedByMe
      post.favorites = updated.favorites
      error.value = null
      return post
    } catch (reason) {
      post.favorites = previous.favorites
      post.favoritedByMe = previous.favoritedByMe
      error.value = messageOf(reason, '操作失败，请稍后重试')
      return null
    }
  }

  return {
    posts,
    loaded,
    loading,
    submitting,
    error,
    sortedPosts,
    total,
    isEmpty,
    countLabel,
    load,
    publish,
    toggleLike,
    toggleFavorite,
  }
})
