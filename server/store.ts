import type { Post } from '../src/lib/post'
import { buildSeedPosts, sanitizePost, sortPosts } from '../src/lib/post'

export interface CreatePostInput {
  content: unknown
  author?: unknown
}

export interface PostStoreOptions {
  /** 注入时钟，便于测试；默认 Date.now */
  now?: () => number
  /** 播种函数，默认复用前端的示例动态 */
  seed?: (now: number) => Post[]
}

export interface PostStore {
  list(): Post[]
  create(input: CreatePostInput): Post | null
  setLike(id: string, liked: boolean): Post | null
  setFavorite(id: string, favorited: boolean): Post | null
  reset(): void
}

/**
 * 纯内存仓库：进程即数据库，重启后回到示例数据。
 * 首次访问惰性播种，reset() 之后下次访问会重新播种。
 */
export function createPostStore(options: PostStoreOptions = {}): PostStore {
  const now = options.now ?? (() => Date.now())
  const seed = options.seed ?? buildSeedPosts

  let posts: Post[] | null = null

  function ensure(): Post[] {
    if (!posts) posts = seed(now()).map((post) => ({ ...post }))
    return posts
  }

  return {
    list() {
      // 返回副本，避免调用方（包括测试）直接改动仓库内部状态
      return sortPosts(ensure()).map((post) => ({ ...post }))
    },

    create(input) {
      const post = sanitizePost(
        {
          author: input.author,
          content: input.content,
          createdAt: now(),
          likes: 0,
          likedByMe: false,
          favorites: 0,
          favoritedByMe: false,
        },
        now(),
      )
      if (!post) return null

      ensure().unshift(post)
      return { ...post }
    },

    setLike(id, liked) {
      const post = ensure().find((item) => item.id === id)
      if (!post) return null

      if (post.likedByMe !== liked) {
        post.likedByMe = liked
        post.likes = Math.max(0, post.likes + (liked ? 1 : -1))
      }

      return { ...post }
    },

    setFavorite(id, favorited) {
      const post = ensure().find((item) => item.id === id)
      if (!post) return null

      if (post.favoritedByMe !== favorited) {
        post.favoritedByMe = favorited
        post.favorites = Math.max(0, post.favorites + (favorited ? 1 : -1))
      }

      return { ...post }
    },

    reset() {
      posts = null
    },
  }
}
