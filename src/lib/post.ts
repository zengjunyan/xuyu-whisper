/** 单条动态 */
export interface Post {
  id: string
  author: string
  createdAt: number
  content: string
  likes: number
  likedByMe: boolean
}

/** 正文上限 */
export const MAX_LEN = 280
/** 本机用户昵称 */
export const ME = '我自己'

/** 头像渐变，按昵称哈希取色，保证同一个人颜色稳定 */
export const AVATAR_GRADIENTS = [
  ['#E3A87C', '#C2683F'],
  ['#9FB49B', '#5F7A5C'],
  ['#A3AECD', '#5E6C93'],
  ['#D8A6AD', '#A75F6D'],
  ['#CDB68B', '#9A7F4E'],
  ['#B9A6C9', '#75628C'],
] as const

/** 生成类似 p_mp3k2x_9f1a 的 id */
export function createId(timestamp: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
    .slice(-4)
  return `p_${timestamp.toString(36)}_${suffix}`
}

/**
 * 把来路不明的数据清洗成合法动态；无法挽救时返回 null。
 * 读取本地存储与发布入口共用这一份规则。
 */
export function sanitizePost(raw: unknown, now: number = Date.now()): Post | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const record = raw as Record<string, unknown>
  const content = typeof record.content === 'string' ? record.content.trim() : ''
  if (!content) return null

  const author =
    typeof record.author === 'string' && record.author.trim() ? record.author.trim() : ME

  const likes =
    typeof record.likes === 'number' && Number.isFinite(record.likes) && record.likes > 0
      ? Math.floor(record.likes)
      : 0

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId(now),
    author,
    createdAt:
      typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
        ? record.createdAt
        : now,
    content: content.slice(0, MAX_LEN),
    likes,
    likedByMe: record.likedByMe === true,
  }
}

/** 按发布时间倒序，返回新数组 */
export function sortPosts(posts: readonly Post[]): Post[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt)
}

/** 首次访问的示例动态（原创文案） */
export function buildSeedPosts(now: number = Date.now()): Post[] {
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  const seeds = [
    {
      id: 'seed-linwan',
      author: '林晚',
      createdAt: now - 6 * minute,
      content:
        '傍晚收衣服的时候，风里有一点桂花味。秋天好像终于把脚伸进了这座城市，轻轻的，怕吵到谁。',
      likes: 12,
      likedByMe: false,
    },
    {
      id: 'seed-aju',
      author: '阿橘',
      createdAt: now - 3 * hour,
      content:
        '今天把阳台那几盆多肉重新换了土，弄了一手泥。明明只是浇水换盆这种小事，成就感却莫名其妙地高。',
      likes: 8,
      likedByMe: false,
    },
    {
      id: 'seed-shen',
      author: '沈青野',
      createdAt: now - 27 * hour,
      content: '重读一本旧书，才发现当年划线的句子，现在读来完全是另一层意思。书没变，是我变了。',
      likes: 21,
      likedByMe: false,
    },
    {
      id: 'seed-nanzhi',
      author: '南枝',
      createdAt: now - 3 * day,
      content:
        '凌晨写完最后一页，关灯之前听见楼下有人推着自行车走过，链条声很轻。城市安静下来的时候，才听得见它呼吸。',
      likes: 34,
      likedByMe: false,
    },
  ]

  return seeds.map((seed) => sanitizePost(seed, now)).filter((post): post is Post => post !== null)
}

/** 昵称哈希到一组固定渐变 */
export function avatarGradient(name: string): readonly [string, string] {
  let sum = 0
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i)
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length]
}

/** 取昵称首字做头像 */
export function initialOf(name: string): string {
  return name.trim().slice(0, 1) || '絮'
}
