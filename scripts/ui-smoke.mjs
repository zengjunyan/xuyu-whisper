/**
 * 真实浏览器验收脚本（需要本机已安装 Chrome 或 Edge）
 * 用法：npm run build && npm run preview，然后 npm run verify:ui
 */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173/'
const CHROME_PATH = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = 'artifacts/screenshots'

let checks = 0
const log = (message) => {
  checks += 1
  console.log(`  ✓ ${message}`)
}

await mkdir(SHOTS, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'zh-CN',
  colorScheme: 'light',
})
const page = await context.newPage()
const errors = []

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`)
})

const postCount = () => page.locator('.post').count()
const waitPosts = (count) =>
  page.waitForFunction((expected) => document.querySelectorAll('.post').length === expected, count)

await page.goto(BASE_URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.post')

/* ---------- 1. 首屏与可访问性 ---------- */
assert.equal(await postCount(), 4, '首屏应载入 4 条示例动态')
assert.match(await page.locator('#today-label').innerText(), /^\d{1,2} 月 \d{1,2} 日 · 星期/, '日期标题')
assert.match(await page.locator('.feed-head__count').innerText(), /共 4 条/, '计数文案')
assert.equal(await page.getAttribute('html', 'lang'), 'zh-CN')
assert.equal(await page.locator('.feed').getAttribute('aria-live'), 'polite')
assert.equal(await page.locator('#meter').getAttribute('aria-live'), 'off')
assert.equal(await page.locator('#publish-btn').isDisabled(), true, '空内容时发布按钮禁用')

const unnamedButtons = await page.$$eval(
  'button',
  (buttons) => buttons.filter((button) => !(button.getAttribute('aria-label') || button.textContent.trim())).length,
)
assert.equal(unnamedButtons, 0, '所有按钮都应有可读名称')
log('首屏示例数据、日期、计数与基础可访问性正常')

await page.waitForFunction(() => {
  const layer = document.querySelector('.scene-layer.is-active')
  return layer instanceof HTMLElement && getComputedStyle(layer).backgroundImage.includes('bg-')
})
const firstBg = await page
  .locator('.scene-layer.is-active')
  .evaluate((el) => getComputedStyle(el).backgroundImage)
assert.match(firstBg, /bg-\d{2}\.jpg/, '壁纸应已加载')
assert.match(await page.locator('.scene-chip').getAttribute('title'), /^当前背景 · /)
log(`壁纸已加载：${firstBg}`)

await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/desktop-light.png` })

/* ---------- 2. 跟随系统主题 ---------- */
assert.equal(await page.getAttribute('html', 'data-theme-mode'), 'system')
assert.equal(await page.getAttribute('html', 'data-theme'), 'light')
await page.emulateMedia({ colorScheme: 'dark' })
await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
assert.equal(await page.locator('#theme-color-meta').getAttribute('content'), '#14110F')
assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true')
// 等颜色过渡结束再截图，避免拍到中间态
await page.waitForTimeout(700)
await page.screenshot({ path: `${SHOTS}/system-dark.png` })
log('系统切到深色后页面立即跟随，主题色与按钮状态同步')

await page.emulateMedia({ colorScheme: 'light' })
await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
assert.equal(await page.locator('#theme-color-meta').getAttribute('content'), '#FAF6EF')
log('系统切回浅色后页面同步响应')

/* ---------- 3. 发布前校验 ---------- */
await page.fill('#composer-input', '   ')
assert.equal(await page.locator('#publish-btn').isDisabled(), true, '纯空白不能发布')
await page.locator('#composer-input').press('Control+Enter')
assert.equal(await postCount(), 4, '空白内容快捷键也不应发布')
assert.equal(await page.locator('#toast').getAttribute('class'), 'toast', '不应出现提示')
await page.fill('#composer-input', '絮'.repeat(280))
assert.equal(await page.locator('#char-count').innerText(), '0')
assert.equal(await page.locator('#meter').evaluate((el) => el.classList.contains('is-limit')), true)
assert.equal(await page.locator('#publish-btn').isEnabled(), true, '满 280 字仍可发布')
await page.fill('#composer-input', '')
log('空白内容被拒绝；280 字达到上限时计数与样式正确')

/* ---------- 4. 发布 ---------- */
const shortPost = '自动化验收：今天的风很轻。'
await page.fill('#composer-input', shortPost)
assert.equal(await page.locator('#char-count').innerText(), String(280 - shortPost.length))
assert.equal(await page.locator('#publish-btn').isEnabled(), true, '有内容时发布按钮可用')
await page.click('#publish-btn')
await waitPosts(5)

const newCard = page.locator('.post').first()
assert.equal(await newCard.locator('.post__body').innerText(), shortPost)
assert.equal(await newCard.locator('.post__author').innerText(), '我自己')
assert.equal(await newCard.locator('.post__time').innerText(), '刚刚')
assert.equal(await newCard.evaluate((el) => el.classList.contains('is-new')), true, '新动态高亮')
assert.match(await page.locator('.feed-head__count').innerText(), /共 5 条/)
assert.equal(await page.locator('#composer-input').inputValue(), '', '发布后应清空输入框')
assert.equal(await page.locator('#toast').getAttribute('class'), 'toast is-visible', '发布提示可见')
assert.match(await page.locator('#toast').innerText(), /已发布，静候回响/)
log('发布成功：置顶、高亮、清空输入、计数与提示正常')

const stored = await page.evaluate(async () => (await fetch('/api/posts')).json())
assert.equal(stored.length, 5, '发布后应写入后端')
assert.deepEqual(
  Object.keys(stored[0]).sort(),
  ['author', 'content', 'createdAt', 'favoritedByMe', 'favorites', 'id', 'likedByMe', 'likes'],
  'API 返回结构应包含点赞与收藏字段',
)
assert.equal(stored[0].favorites, 0, '新发布动态的收藏数应为 0')
assert.equal(stored[0].favoritedByMe, false, '新发布动态默认未收藏')
assert.equal(stored[0].content, shortPost)
assert.equal(
  await page.evaluate(() => localStorage.getItem('whisper.posts.v1')),
  null,
  '动态不应再写入 localStorage',
)
log('发布结果写入后端 REST API，字段与旧版一致且未落 localStorage')

/* ---------- 4.1 REST 契约（用 APIRequest，避免预期内的 4xx 污染控制台断言） ---------- */
const apiUrl = (path) => new URL(path, BASE_URL).toString()

const emptyResponse = await page.request.post(apiUrl('/api/posts'), { data: { content: '   ' } })
assert.equal(emptyResponse.status(), 400, '空内容由服务端拒绝')
assert.equal((await emptyResponse.json()).error.code, 'INVALID_CONTENT')

const notFoundResponse = await page.request.put(apiUrl('/api/posts/not-exist/like'), {
  data: { liked: true },
})
assert.equal(notFoundResponse.status(), 404, '未知动态返回 404')
assert.equal((await notFoundResponse.json()).error.code, 'NOT_FOUND')

const invalidBodyResponse = await page.request.put(apiUrl(`/api/posts/${stored[0].id}/like`), {
  data: { liked: 'yes' },
})
assert.equal(invalidBodyResponse.status(), 400, 'liked 非布尔值返回 400')

const invalidFavoriteResponse = await page.request.put(
  apiUrl(`/api/posts/${stored[0].id}/favorite`),
  { data: { favorited: 'yes' } },
)
assert.equal(invalidFavoriteResponse.status(), 400, 'favorited 非布尔值返回 400')
assert.equal((await invalidFavoriteResponse.json()).error.code, 'INVALID_BODY')

const missingFavoriteResponse = await page.request.put(apiUrl('/api/posts/not-exist/favorite'), {
  data: { favorited: true },
})
assert.equal(missingFavoriteResponse.status(), 404, '未知动态收藏返回 404')
log('REST 契约：空内容 400、非布尔 liked/favorited 400、未知资源 404')

await page.locator('.feed-head').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/desktop-feed.png` })

await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('is-visible'), null, {
  timeout: 4000,
})
log('提示在 2.2 秒后自动隐藏')

/* ---------- 5. 点赞与取消 ---------- */
let firstPost = page.locator('.post').first()
const likedId = await firstPost.getAttribute('data-id')
assert.equal(await firstPost.locator('.like-btn').getAttribute('aria-pressed'), 'false')
assert.equal(await firstPost.locator('.like-btn').getAttribute('aria-label'), '点赞，我自己')

await firstPost.locator('.like-btn').click()
assert.equal(await firstPost.locator('.like-btn').getAttribute('aria-pressed'), 'true')
assert.equal(await firstPost.locator('.like-btn').getAttribute('aria-label'), '取消点赞，我自己')
assert.equal(await firstPost.locator('.like-btn__count').innerText(), '1')

await firstPost.locator('.like-btn').click()
assert.equal(await firstPost.locator('.like-btn').getAttribute('aria-pressed'), 'false')
assert.equal(await firstPost.locator('.like-btn__count').innerText(), '0')

await firstPost.locator('.like-btn').click()
assert.equal(await firstPost.locator('.like-btn__count').innerText(), '1')
log('点赞、取消、再次点赞：状态、计数与无障碍标签同步')

/* ---------- 5.1 收藏与「我的收藏」筛选 ---------- */
firstPost = page.locator('.post').first()
assert.equal(await firstPost.locator('.fav-btn').getAttribute('aria-pressed'), 'false')
assert.equal(await firstPost.locator('.fav-btn').getAttribute('aria-label'), '收藏，我自己')
assert.equal(await firstPost.locator('.fav-btn__count').innerText(), '0')

await firstPost.locator('.fav-btn').click()
assert.equal(await firstPost.locator('.fav-btn').getAttribute('aria-pressed'), 'true')
assert.equal(await firstPost.locator('.fav-btn').getAttribute('aria-label'), '取消收藏，我自己')
assert.equal(await firstPost.locator('.fav-btn__count').innerText(), '1')

await page.click('#filter-favorites')
assert.equal(await page.locator('#filter-favorites').getAttribute('aria-pressed'), 'true')
assert.equal(await page.locator('#filter-all').getAttribute('aria-pressed'), 'false')
assert.equal(await postCount(), 1, '「我的收藏」只展示已收藏动态')
assert.equal(await page.locator('.feed-head__count').innerText(), '收藏 1 条')
await page.screenshot({ path: `${SHOTS}/desktop-favorites.png` })

await page.locator('.post .fav-btn').click()
await page.waitForFunction(() => document.querySelectorAll('.post').length === 0)
assert.equal(await page.locator('.empty__title').innerText(), '还没有收藏')
assert.equal(await page.locator('.feed-head__count').innerText(), '暂无收藏')

await page.locator('#empty-reset').click()
assert.equal(await page.locator('#filter-all').getAttribute('aria-pressed'), 'true')
assert.equal(await postCount(), 5, '回到全部后恢复完整时间线')
assert.equal(await page.locator('.feed-head__count').innerText(), '共 5 条')

// 重新收藏，供后续刷新持久化断言使用
await page.locator('.post').first().locator('.fav-btn').click()
assert.equal(await page.locator('.post').first().locator('.fav-btn__count').innerText(), '1')
log('收藏、筛选、收藏空状态与「回到全部」：状态、计数与文案同步')

/* ---------- 6. 长文展开 ---------- */
const longPost = '凌晨写完最后一页，关灯之前听见楼下有人推着自行车走过，链条声很轻。'.repeat(5).slice(0, 200)
await page.fill('#composer-input', longPost)
await page.click('#publish-btn')
await waitPosts(6)

const longCard = page.locator('.post').first()
assert.equal(await longCard.locator('.expand-btn').innerText(), '展开全文')
assert.equal(await longCard.locator('.expand-btn').getAttribute('aria-expanded'), 'false')
assert.equal(await longCard.locator('.post__body').evaluate((el) => el.classList.contains('is-expanded')), false)
await longCard.locator('.expand-btn').click()
assert.equal(await longCard.locator('.expand-btn').innerText(), '收起')
assert.equal(await longCard.locator('.expand-btn').getAttribute('aria-expanded'), 'true')
assert.equal(await longCard.locator('.post__body').evaluate((el) => el.classList.contains('is-expanded')), true)
await longCard.locator('.expand-btn').click()
assert.equal(await longCard.locator('.expand-btn').innerText(), '展开全文')
log('长文「展开全文 / 收起」与 aria-expanded 正常')

/* ---------- 7. 主题循环 ---------- */
await page.click('#theme-toggle')
assert.equal(await page.getAttribute('html', 'data-theme-mode'), 'light')
assert.equal(await page.getAttribute('html', 'data-theme'), 'light')
assert.equal(await page.evaluate(() => localStorage.getItem('whisper.theme.v2')), 'light')
assert.match(await page.locator('#toast').innerText(), /已切换为浅色模式/)

await page.click('#theme-toggle')
assert.equal(await page.getAttribute('html', 'data-theme-mode'), 'dark')
assert.equal(await page.getAttribute('html', 'data-theme'), 'dark')
assert.equal(await page.evaluate(() => localStorage.getItem('whisper.theme.v2')), 'dark')
assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true')
assert.match(await page.locator('#toast').innerText(), /已切换为深色模式/)
assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'), '明暗主题：深色，点击切换为跟随系统')
log('主题按 跟随系统 → 浅色 → 深色 循环，并写入偏好')

await page.waitForTimeout(700)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/desktop-dark.png` })

/* ---------- 8. 换背景 ---------- */
const sceneName = await page.locator('.scene-chip__name').innerText()
const bgBefore = await page
  .locator('.scene-layer.is-active')
  .evaluate((el) => getComputedStyle(el).backgroundImage)
await page.click('#scene-next')
await page.waitForFunction(
  (previous) => document.querySelector('.scene-chip__name')?.textContent.trim() !== previous,
  sceneName,
)
const nextSceneName = await page.locator('.scene-chip__name').innerText()
assert.notEqual(nextSceneName, sceneName)
assert.equal(await page.locator('#toast').innerText(), `换了一张 · ${nextSceneName}`)
assert.equal(await page.locator('.scene-chip').getAttribute('title'), `当前背景 · ${nextSceneName}`)
assert.ok(['light', 'dark'].includes(await page.getAttribute('html', 'data-scene-tone')))
await page.waitForFunction(() => {
  const layer = document.querySelector('.scene-layer.is-active')
  return layer instanceof HTMLElement && getComputedStyle(layer).backgroundImage.includes('bg-')
})
const bgAfter = await page
  .locator('.scene-layer.is-active')
  .evaluate((el) => getComputedStyle(el).backgroundImage)
assert.notEqual(bgAfter, bgBefore, '壁纸应实际切换')
log(`壁纸切换：${sceneName} → ${nextSceneName}，提示、角标与画面同步`)

/* ---------- 9. 刷新持久化 ---------- */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.post')
assert.equal(await postCount(), 6, '刷新后动态数量保持')
assert.equal(await page.getAttribute('html', 'data-theme-mode'), 'dark', '刷新后主题保持')
assert.equal(
  await page.locator(`[data-id="${likedId}"] .like-btn`).getAttribute('aria-pressed'),
  'true',
  '刷新后点赞保持',
)
assert.equal(
  await page.locator(`[data-id="${likedId}"] .like-btn__count`).innerText(),
  '1',
  '刷新后点赞数保持',
)
assert.equal(
  await page.locator(`[data-id="${likedId}"] .fav-btn`).getAttribute('aria-pressed'),
  'true',
  '刷新后收藏保持',
)
assert.equal(
  await page.locator(`[data-id="${likedId}"] .fav-btn__count`).innerText(),
  '1',
  '刷新后收藏数保持',
)
// 手动换背景只作用于本次会话，刷新后回到整点排期，与旧版行为一致
assert.equal(await page.locator('.scene-chip__name').innerText(), sceneName, '刷新后回到整点排期')
log('刷新后动态、点赞、收藏、主题保持；手动壁纸回到排期')

/* ---------- 10. 快捷键发布 ---------- */
await page.fill('#composer-input', '用快捷键发布')
await page.locator('#composer-input').press('Control+Enter')
await waitPosts(7)
assert.equal(await page.locator('.post').first().locator('.post__body').innerText(), '用快捷键发布')
log('Ctrl + Enter 快捷发布正常')

/* ---------- 11. 满 280 字发布 ---------- */
const maxText = '絮'.repeat(280)
await page.fill('#composer-input', maxText)
await page.click('#publish-btn')
await waitPosts(8)
assert.equal(await page.locator('.post').first().locator('.post__body').innerText().then((t) => t.length), 280)
log('280 字正文可正常发布且不被截断')

/* ---------- 12. 切回跟随系统 ---------- */
await page.click('#theme-toggle')
assert.equal(await page.getAttribute('html', 'data-theme-mode'), 'system')
assert.equal(await page.getAttribute('html', 'data-theme'), 'light')
assert.equal(await page.evaluate(() => localStorage.getItem('whisper.theme.v2')), 'system')
assert.match(await page.locator('#toast').innerText(), /已跟随系统 · 浅色/)
log('主题回到「跟随系统」，偏好写入 system')

/* ---------- 13. 移动端 ---------- */
await page.setViewportSize({ width: 390, height: 844 })
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(400)
const mobileWidth = await page.locator('.composer').evaluate((el) => el.getBoundingClientRect().width)
assert.ok(mobileWidth <= 390, '移动端不应横向溢出')
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  true,
  '无横向滚动',
)
assert.equal(await page.locator('#filter-favorites').isVisible(), true, '移动端收藏页签可见')
assert.equal(
  await page.locator('.feed-filter').evaluate((el) => el.getBoundingClientRect().width <= 390),
  true,
  '筛选页签不应溢出屏幕',
)
await page.click('#filter-favorites')
assert.equal(await postCount(), 1, '移动端「我的收藏」过滤生效')
await page.click('#filter-all')
await page.screenshot({ path: `${SHOTS}/mobile-light.png` })
log('移动端 390px 布局与收藏筛选正常，无横向滚动')

/* ---------- 14. 跨整点自动换壁纸（独立上下文，模拟时间前进） ---------- */
const clockContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'zh-CN',
  colorScheme: 'light',
})
await clockContext.addInitScript(() => {
  const realNow = Date.now.bind(Date)
  let offset = 0
  Object.defineProperty(window, '__whisperOffset', {
    configurable: true,
    get: () => offset,
    set: (value) => {
      offset = value
    },
  })
  Date.now = () => realNow() + offset
})
const clockPage = await clockContext.newPage()
clockPage.on('pageerror', (error) => errors.push(`clock pageerror: ${error.message}`))
clockPage.on('console', (message) => {
  if (message.type() === 'error') errors.push(`clock console: ${message.text()}`)
})
await clockPage.goto(BASE_URL, { waitUntil: 'networkidle' })
await clockPage.waitForSelector('.post')

const scheduledName = await clockPage.locator('.scene-chip__name').innerText()
await clockPage.click('#scene-next')
await clockPage.click('#scene-next')
const manualName = await clockPage.locator('.scene-chip__name').innerText()
assert.notEqual(manualName, scheduledName)

// 模拟休眠/跨小时后回到页面
await clockPage.evaluate(() => {
  window.__whisperOffset = 3_600_000
  document.dispatchEvent(new Event('visibilitychange'))
})
await clockPage.waitForFunction(
  (previous) => document.querySelector('.scene-chip__name')?.textContent.trim() !== previous,
  manualName,
)
assert.notEqual(await clockPage.locator('.scene-chip__name').innerText(), manualName)
log('跨整点回到页面：壁纸自动切换并清除手动选择')

await clockContext.close()

assert.equal(errors.length, 0, `控制台不应有错误：${errors.join(' | ')}`)
log('控制台无错误、无未捕获异常、无失败请求')

await browser.close()
console.log(`\n浏览器验收全部通过：${checks} 项检查，截图位于 artifacts/screenshots/`)
