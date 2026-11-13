# 絮语 Whisper

一个极简的动态应用：发布、浏览、点赞、收藏。数据由本地 **Hono REST 服务 + 内存存储** 承载，明暗主题偏好仍留在浏览器；界面会随系统明暗自动切换，背景是一组暖调壁纸，每个整点换一张。

本项目全程以 **测试驱动开发（TDD）** 推进：Vue 3 + Pinia 前端、Hono 后端、Vitest 单测与真实浏览器验收。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 运行时 | Node.js 20.19+（开发使用 22 / 26） |
| 前端 | Vue 3.5 · Composition API · `<script setup lang="ts">` · Pinia 3 |
| 后端 | Hono 4 · @hono/node-server 2 · tsx（TypeScript 直跑） |
| 构建 | Vite 7（开发与预览均把 `/api` 代理到后端） |
| 测试 | Vitest 3 · @vue/test-utils · jsdom（前端）/ node（服务端） |
| 类型 | TypeScript 5.9 · vue-tsc |
| 存储 | 进程内存（重启回到示例数据）；仅主题偏好使用 localStorage |

## 快速开始

```bash
npm install
npm run dev        # 同时启动 API(8787) 与前端(5173)，Vite 代理 /api
npm run build      # 类型检查 + 生产构建到 dist/
npm run preview    # 预览构建产物 http://localhost:4173（需同时有 API 在跑）
```

单独启动：

```bash
npm run server     # 仅启动 API：http://127.0.0.1:8787
npm run dev:web    # 仅启动前端
PORT=9000 npm run server   # 换端口（Windows PowerShell: $env:PORT=9000）
```

> 前端所有请求都走同源 `/api/**`，由 Vite 的 `server.proxy` / `preview.proxy` 转发到 `http://127.0.0.1:8787`，因此浏览器里没有任何跨域配置。

## 测试与验收

```bash
npm test            # 14 个测试文件、164 个用例
npm run coverage    # 覆盖率报告（lib + stores + server）
npm run check       # vue-tsc 类型检查
npm run verify:ui   # 真实浏览器端到端验收（需本机 Chrome / Edge，且 API 与 preview 已启动）
```

最近一次验收结果：

- `npm test`：**14 个文件 / 164 个用例全部通过**
- 覆盖率：语句 **97.03%**、分支 **93.60%**、函数 **96.72%**（`server/index.ts` 为进程入口，不计入）
- `npm run build`：类型检查通过，产物 94.8 KB JS（gzip 37.2 KB）+ 23.2 KB CSS
- `npm run verify:ui`（真实 Chrome，**21 项检查全部通过**）：首屏示例数据、壁纸、跟随系统明暗、空白内容拦截、280 字上限、发布与高亮、**发布结果写入后端且不再写 localStorage**、REST 契约（空内容 400 / 非布尔 liked 400 / 非布尔 favorited 400 / 未知资源 404）、提示自动隐藏、点赞/取消/再点赞、**收藏/「我的收藏」筛选/收藏空状态/回到全部**、长文展开收起、主题循环与持久化、换背景与角标同步、刷新持久化（含收藏）、`Ctrl + Enter`、满字发布、回到跟随系统、390px 移动端无横向滚动、跨整点自动换壁纸、控制台零错误与零失败请求；截图见 `artifacts/screenshots/`

## TDD 过程

严格按「红 → 绿 → 重构」推进，测试先于实现：

1. **后端先红**：先写 `tests/server/api.spec.ts`（38 个用例），运行得到「模块不存在」的失败，再实现 `server/store.ts` / `server/app.ts` / `server/index.ts`。
2. **前端再红**：先写 `tests/unit/api-client.spec.ts`（14 个用例）与重写 `tests/unit/posts-store.spec.ts`（17 个用例），确认失败后才实现 `src/lib/api.ts`、改造 `src/stores/posts.ts`。
3. **组件与集成收口**：把 `composer-card` / `app` 用例改为等待异步数据流，全部转绿。
4. **重构**：服务端清洗规则完全复用前端纯函数（`sanitizePost` / `sortPosts` / `buildSeedPosts`），前端 store 只保留状态与乐观更新；最后跑真实浏览器验收。

测试分层：

```
tests/
├── server/          # 后端路由与内存仓库：app.request() 驱动，node 环境
│   └── api.spec.ts
├── unit/            # 纯函数、API 客户端、store 状态机
│   ├── api-client.spec.ts
│   ├── datetime.spec.ts
│   ├── post.spec.ts
│   ├── storage.spec.ts
│   ├── posts-store.spec.ts
│   ├── theme-store.spec.ts
│   ├── scene-store.spec.ts
│   └── toast-store.spec.ts
├── components/      # 组件黑盒测试：发布框、动态卡片、信息流、顶栏
├── integration/     # 真实 Pinia + 真实 Hono 实例的整页流程
└── helpers/
    ├── api-mock.ts  # 把全局 fetch 接到真实 Hono 应用（无网络、无额外依赖）
    └── match-media.ts
```

## 目录结构

```
ceshi/
├── index.html                 # Vite 入口：首屏防闪烁主题脚本 + #app
├── public/                    # 8 张本地壁纸 + favicon
├── server/
│   ├── store.ts               # 内存仓库：惰性播种、列表副本、点赞/收藏幂等
│   ├── app.ts                 # Hono 路由与校验（不监听端口，测试与前端 mock 复用）
│   └── index.ts               # 进程入口：监听 PORT（默认 8787），端口占用友好退出
├── src/
│   ├── main.ts                # createApp + Pinia + 全局样式
│   ├── App.vue                # 组合页面、初始化 store、错误提示
│   ├── assets/styles.css      # 设计令牌 / 玻璃质感 / 动效 / 响应式
│   ├── components/            # SceneBackdrop / TopBar / IntroSection / ComposerCard / FeedSection（含「我的收藏」筛选）/ PostCard / AppToast
│   ├── lib/
│   │   ├── api.ts             # 唯一的后端访问入口：fetchPosts / createPost / setPostLike / setPostFavorite + ApiError
│   │   ├── post.ts            # 类型、清洗、排序、示例数据、头像（前后端共享）
│   │   ├── datetime.ts        # 相对时间 / 今日日期
│   │   ├── storage.ts         # 安全的 localStorage 适配（仅主题偏好）
│   │   └── scenes.ts          # 壁纸表与整点排期
│   └── stores/                # posts / theme / scene / toast
├── tests/                     # Vitest 测试（见上）
├── scripts/ui-smoke.mjs       # Playwright 真实浏览器验收
└── vite.config.ts             # 别名 @ → src、/api 代理、Vitest 配置
```

## 后端 API

所有响应均为 `application/json`；错误统一为 `{ "error": { "code", "message" } }`。

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 健康检查 | `200 { ok: true }` | — |
| GET | `/api/posts` | 全部动态，按时间倒序；首次访问播种 4 条 | `200 Post[]` | — |
| POST | `/api/posts` | 发布，body `{ content, author? }` | `201 Post` | `400 INVALID_CONTENT` / `400 INVALID_BODY` |
| PUT | `/api/posts/:id/like` | 点赞状态，body `{ liked: boolean }`，幂等 | `200 Post` | `400 INVALID_BODY` / `404 NOT_FOUND` |
| PUT | `/api/posts/:id/favorite` | 收藏状态，body `{ favorited: boolean }`，幂等 | `200 Post` | `400 INVALID_BODY` / `404 NOT_FOUND` |

单条动态：

```json
{
  "id": "p_mp3k2x_9f1a",
  "author": "我自己",
  "createdAt": 1763000000000,
  "content": "动态正文",
  "likes": 3,
  "likedByMe": true,
  "favorites": 2,
  "favoritedByMe": false
}
```

服务端规则：

- 清洗规则与前端共用 `sanitizePost`：正文 trim、空内容拒绝、超过 280 字截断、作者回退 `我自己`、点赞数与收藏数不为负。
- `createdAt` / `id` 由服务端生成，客户端不参与。
- `PUT .../like` 与 `PUT .../favorite` 均幂等：状态不变时计数不变；点赞与收藏是两条独立状态，互不影响。
- 未知路径与未知资源都返回统一 404 结构。

## 数据存储

- **动态数据**：进程内存，首次访问形成 4 条原创示例；重启服务即回到初始状态（刻意保持「本地轻量」的语义，不引入数据库）。
- **主题偏好**：`localStorage` 键 `whisper.theme.v2`（`system` / `light` / `dark`），启动时清理旧版 `whisper.theme.v1`；隐私模式不可用时降级为本次会话有效，并提示一次。
- 旧的 `whisper.posts.v1` 已不再读写；浏览器里残留的旧数据不会被上传，也不会被使用。

## 功能清单

- **发布**：280 字上限，接近上限时计数变色并提示；`Ctrl / ⌘ + Enter` 快捷发布；320ms 内阻止重复提交；发布后置顶高亮。失败时保留草稿并提示服务端文案。
- **浏览**：按时间倒序的卡片时间线，显示头像、昵称、相对时间（每分钟刷新）与正文。
- **点赞**：乐观更新，失败自动回滚并提示；刷新后保持。
- **收藏**：卡片底部书签按钮切换收藏，收藏数即时更新；信息流顶部可在「全部 / 我的收藏」之间筛选，收藏为空时给出空状态与「回到全部」；刷新后保持。
- **容错**：后端不可达时页面不白屏，展示空状态并提示「无法连接服务器」。
- **主题**：默认跟随系统，系统切换立即响应；右上角按「跟随系统 → 浅色 → 深色」循环并记住选择。
- **整点换背景**：8 张本地壁纸按 `Math.floor(Date.now() / 3600000) % 8` 确定性轮换；整点交叉淡化；右上角可手动换一张（仅当次会话、当小时内有效）。
- **可访问性**：按钮均有 `aria-label`，Toast 使用 `aria-live`，尊重 `prefers-reduced-motion`，桌面 680px 单列、移动端全宽。

## 与旧版的差异

- **存储**：从 localStorage 迁移到 Hono + 内存 REST 服务；动态不再写入浏览器。
- **异步数据流**：`posts.load()` / `publish()` / `toggleLike()` 均为异步，组件等待结果；首屏渲染前不再同步读盘，但保留了空状态与错误提示。
- **长文展开**：按正文长度（> 90 字）判断，避免依赖布局测量，行为可稳定测试。
- **手动换背景**：沿用「仅当次会话有效」的语义，不做持久化。

## 素材与命名

「絮语 Whisper」为原创命名，界面文案、图标、图标内 SVG、favicon 与全部壁纸均为原创或 AI 生成，不含任何第三方平台的名称、标识或品牌元素。
