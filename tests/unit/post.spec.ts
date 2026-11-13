import { describe, expect, it } from 'vitest'
import {
  AVATAR_GRADIENTS,
  MAX_LEN,
  ME,
  avatarGradient,
  buildSeedPosts,
  createId,
  initialOf,
  sanitizePost,
  sortPosts,
  type Post,
} from '@/lib/post'

function makePost(patch: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'p_fixed',
    author: '林晚',
    createdAt: 1_700_000_000_000,
    content: '风里有一点桂花味。',
    likes: 3,
    likedByMe: false,
    ...patch,
  }
}

describe('createId', () => {
  it('生成 p_ 前缀、时间戳与 4 位随机后缀的 id', () => {
    const id = createId(1_700_000_000_000, () => 0)
    expect(id).toMatch(/^p_[0-9a-z]+_[0-9a-z]{4}$/)
  })

  it('随机数决定后缀，便于测试', () => {
    expect(createId(0, () => 0)).toBe('p_0_0000')
    expect(createId(0, () => 0.999999)).toMatch(/^p_0_[0-9a-z]{4}$/)
    expect(createId(0, () => 0.999999)).not.toBe('p_0_0000')
  })

  it('真实随机下不重复', () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId()))
    expect(ids.size).toBe(500)
  })
})

describe('sanitizePost', () => {
  it('拒绝非对象与缺失正文的数据', () => {
    expect(sanitizePost(null)).toBeNull()
    expect(sanitizePost(undefined)).toBeNull()
    expect(sanitizePost('text')).toBeNull()
    expect(sanitizePost([])).toBeNull()
    expect(sanitizePost({})).toBeNull()
    expect(sanitizePost({ content: '   ' })).toBeNull()
    expect(sanitizePost({ content: 42 })).toBeNull()
  })

  it('去掉正文首尾空白', () => {
    const post = sanitizePost(makePost({ content: '  此刻很好  ' }))
    expect(post?.content).toBe('此刻很好')
  })

  it('把正文截断到 280 字', () => {
    const post = sanitizePost(makePost({ content: '絮'.repeat(400) }))
    expect(post?.content).toHaveLength(MAX_LEN)
  })

  it('作者缺失或空白时回退为「我自己」', () => {
    expect(sanitizePost(makePost({ author: undefined }))?.author).toBe(ME)
    expect(sanitizePost(makePost({ author: '   ' }))?.author).toBe(ME)
    expect(sanitizePost(makePost({ author: ' 阿橘 ' }))?.author).toBe('阿橘')
  })

  it('把非法点赞数归零，正数向下取整', () => {
    expect(sanitizePost(makePost({ likes: -5 }))?.likes).toBe(0)
    expect(sanitizePost(makePost({ likes: Number.NaN }))?.likes).toBe(0)
    expect(sanitizePost(makePost({ likes: '8' }))?.likes).toBe(0)
    expect(sanitizePost(makePost({ likes: 8.9 }))?.likes).toBe(8)
  })

  it('只有 true 才算已点赞', () => {
    expect(sanitizePost(makePost({ likedByMe: true }))?.likedByMe).toBe(true)
    expect(sanitizePost(makePost({ likedByMe: 'true' }))?.likedByMe).toBe(false)
    expect(sanitizePost(makePost({ likedByMe: 1 }))?.likedByMe).toBe(false)
  })

  it('补齐缺失的 id 与非法时间', () => {
    const post = sanitizePost(makePost({ id: '', createdAt: 'x' }), 1_800_000_000_000)
    expect(post?.id).toMatch(/^p_/)
    expect(post?.createdAt).toBe(1_800_000_000_000)
  })

  it('保留合法的 id 与时间，且不修改原始对象', () => {
    const raw = makePost()
    const snapshot = { ...raw }
    const post = sanitizePost(raw)

    expect(post).toMatchObject({ id: 'p_fixed', createdAt: 1_700_000_000_000 })
    expect(raw).toEqual(snapshot)
    expect(post).not.toBe(raw)
  })
})

describe('sortPosts', () => {
  it('按时间倒序，且不修改入参', () => {
    const posts: Post[] = [
      {
        id: 'a',
        author: ME,
        createdAt: 1,
        content: 'a',
        likes: 0,
        likedByMe: false,
      },
      {
        id: 'c',
        author: ME,
        createdAt: 3,
        content: 'c',
        likes: 0,
        likedByMe: false,
      },
      {
        id: 'b',
        author: ME,
        createdAt: 2,
        content: 'b',
        likes: 0,
        likedByMe: false,
      },
    ]

    const sorted = sortPosts(posts)

    expect(sorted.map((item) => item.id)).toEqual(['c', 'b', 'a'])
    expect(posts.map((item) => item.id)).toEqual(['a', 'c', 'b'])
    expect(sorted).not.toBe(posts)
  })
})

describe('buildSeedPosts', () => {
  it('生成 4 条合法且不重复的示例动态', () => {
    const now = 1_800_000_000_000
    const seeds = buildSeedPosts(now)

    expect(seeds).toHaveLength(4)
    expect(new Set(seeds.map((post) => post.id)).size).toBe(4)
    seeds.forEach((post) => {
      expect(post.content.length).toBeGreaterThan(0)
      expect(post.author).not.toBe(ME)
      expect(post.createdAt).toBeLessThan(now)
      expect(post.likes).toBeGreaterThan(0)
      expect(post.likedByMe).toBe(false)
    })
    expect(sortPosts(seeds).map((post) => post.id)).toEqual(seeds.map((post) => post.id))
  })

  it('每次生成都带当前时间基准，不影响原始常量', () => {
    const first = buildSeedPosts(1_000_000)
    const second = buildSeedPosts(2_000_000)
    expect(first[0].createdAt).not.toBe(second[0].createdAt)
  })
})

describe('头像辅助', () => {
  it('同一昵称得到同一组渐变', () => {
    expect(avatarGradient('林晚')).toEqual(avatarGradient('林晚'))
    expect(AVATAR_GRADIENTS).toContainEqual(avatarGradient('林晚'))
  })

  it('取昵称首字，空昵称回退为「絮」', () => {
    expect(initialOf('林晚')).toBe('林')
    expect(initialOf('  阿橘 ')).toBe('阿')
    expect(initialOf('')).toBe('絮')
    expect(initialOf('   ')).toBe('絮')
  })
})
