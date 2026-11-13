import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { LEGACY_THEME_KEY, THEME_KEY, readRawSafe, removeRaw, writeRaw } from '@/lib/storage'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark']

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#FAF6EF',
  dark: '#14110F',
}

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function systemQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null
  return globalThis.matchMedia(MEDIA_QUERY)
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')
  const systemPrefersDark = ref(false)
  const initialized = ref(false)
  const storageOK = ref(true)

  const resolved = computed<ResolvedTheme>(() =>
    mode.value === 'system' ? (systemPrefersDark.value ? 'dark' : 'light') : mode.value,
  )
  const label = computed(() => THEME_LABELS[mode.value])
  const nextMode = computed<ThemeMode>(
    () => THEME_MODES[(THEME_MODES.indexOf(mode.value) + 1) % THEME_MODES.length],
  )
  const toggleLabel = computed(
    () => `明暗主题：${THEME_LABELS[mode.value]}，点击切换为${THEME_LABELS[nextMode.value]}`,
  )

  let mediaQuery: MediaQueryList | null = null
  let mediaHandler: ((event: MediaQueryListEvent) => void) | null = null

  function detectSystemPreference(): void {
    systemPrefersDark.value = systemQuery()?.matches ?? false
  }

  /** 把状态同步到文档根节点与浏览器主题色 */
  function applyToDocument(): void {
    const root = document.documentElement
    root.dataset.theme = resolved.value
    root.dataset.themeMode = mode.value

    document
      .getElementById('theme-color-meta')
      ?.setAttribute('content', THEME_COLORS[resolved.value])
  }

  function setMode(next: ThemeMode, options: { persist?: boolean } = {}): void {
    mode.value = isThemeMode(next) ? next : 'system'
    applyToDocument()

    if (options.persist !== false) {
      const ok = writeRaw(THEME_KEY, mode.value)
      if (!ok) storageOK.value = false
    }
  }

  /** 跟随系统 → 浅色 → 深色 → 跟随系统 */
  function cycle(): ThemeMode {
    setMode(nextMode.value)
    return mode.value
  }

  function handleSystemChange(event: MediaQueryListEvent): void {
    systemPrefersDark.value = event.matches
    if (mode.value === 'system') applyToDocument()
  }

  function init(): void {
    if (initialized.value) return

    const stored = readRawSafe(THEME_KEY)
    if (!stored.ok) storageOK.value = false

    // 旧版本主题键不再使用，静默清理
    removeRaw(LEGACY_THEME_KEY)

    detectSystemPreference()
    setMode(isThemeMode(stored.value) ? stored.value : 'system', { persist: false })

    mediaQuery = systemQuery()
    mediaHandler = handleSystemChange
    mediaQuery?.addEventListener?.('change', mediaHandler)

    initialized.value = true
  }

  function dispose(): void {
    if (mediaQuery && mediaHandler) mediaQuery.removeEventListener?.('change', mediaHandler)
    mediaQuery = null
    mediaHandler = null
    initialized.value = false
  }

  return {
    mode,
    systemPrefersDark,
    resolved,
    label,
    nextMode,
    toggleLabel,
    initialized,
    storageOK,
    init,
    dispose,
    setMode,
    cycle,
  }
})
